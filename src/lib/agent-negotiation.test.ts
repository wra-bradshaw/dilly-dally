import { isBot } from "isbot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	isAgentUserAgent,
	markdownPreference,
	wantsMarkdown,
} from "./agent-negotiation";

vi.mock("isbot", () => ({ isBot: vi.fn() }));

const mockedIsBot = vi.mocked(isBot);

const REAL_CHROME_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const HEADLESS_CHROME_UA =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/139.0.0.0 Safari/537.36";
const CURL_UA = "curl/8.4.0";
const BROWSER_ACCEPT =
	"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

function docRequest(
	url: string,
	init?: { accept?: string; method?: string; ua?: string },
): Request {
	return new Request(url, {
		headers: {
			...(init?.accept !== undefined ? { accept: init.accept } : {}),
			...(init?.ua !== undefined ? { "user-agent": init.ua } : {}),
		},
		method: init?.method ?? "GET",
	});
}

beforeEach(() => {
	mockedIsBot.mockReset();
	mockedIsBot.mockReturnValue(false);
});

describe("markdownPreference", () => {
	it("distinguishes accepted, refused, and absent", () => {
		expect(markdownPreference("text/markdown")).toBe("accepted");
		expect(markdownPreference("text/markdown;q=0")).toBe("refused");
		expect(markdownPreference("text/html")).toBe("absent");
		expect(markdownPreference(null)).toBe("absent");
	});

	it("prefers acceptance when any entry allows markdown", () => {
		expect(markdownPreference("text/markdown;q=0, text/markdown")).toBe(
			"accepted",
		);
	});

	it("matches parameter names case-insensitively", () => {
		expect(markdownPreference("text/markdown; Q=0, text/html")).toBe("refused");
		expect(markdownPreference("text/markdown;Q=0.5")).toBe("accepted");
	});
});

describe("isAgentUserAgent", () => {
	it("delegates the decision to isbot", () => {
		mockedIsBot.mockReturnValue(true);
		expect(isAgentUserAgent("curl/8.4.0")).toBe(true);
		expect(mockedIsBot).toHaveBeenCalledWith("curl/8.4.0");
		mockedIsBot.mockReturnValue(false);
		expect(isAgentUserAgent(REAL_CHROME_UA)).toBe(false);
	});

	it("passes missing user agents through to isbot", () => {
		expect(isAgentUserAgent(null)).toBe(false);
		expect(mockedIsBot).toHaveBeenCalledWith(null);
	});
});

describe("wantsMarkdown", () => {
	it("serves HTML to real browsers that accept html", () => {
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: BROWSER_ACCEPT,
					ua: REAL_CHROME_UA,
				}),
			),
		).toBe(false);
	});

	it("serves HTML to headless chrome even though isbot flags it", () => {
		mockedIsBot.mockReturnValue(true);
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: BROWSER_ACCEPT,
					ua: HEADLESS_CHROME_UA,
				}),
			),
		).toBe(false);
	});

	it("serves markdown to curl with a wildcard accept", () => {
		mockedIsBot.mockReturnValue(true);
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", { accept: "*/*", ua: CURL_UA }),
			),
		).toBe(true);
	});

	it("serves HTML to curl when it explicitly accepts html", () => {
		mockedIsBot.mockReturnValue(true);
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/html",
					ua: CURL_UA,
				}),
			),
		).toBe(false);
	});

	it("serves markdown when the client explicitly prefers it via Accept", () => {
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/markdown",
					ua: REAL_CHROME_UA,
				}),
			),
		).toBe(true);
	});

	it("refuses markdown when the client sets q=0", () => {
		mockedIsBot.mockReturnValue(true);
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/markdown;q=0",
					ua: CURL_UA,
				}),
			),
		).toBe(false);
	});

	it("serves markdown when it outranks html on q-value", () => {
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/html;q=0.5, text/markdown;q=0.9",
					ua: REAL_CHROME_UA,
				}),
			),
		).toBe(true);
	});

	it("serves HTML when html outranks markdown on q-value", () => {
		mockedIsBot.mockReturnValue(true);
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/html;q=0.9, text/markdown;q=0.5",
					ua: HEADLESS_CHROME_UA,
				}),
			),
		).toBe(false);
	});

	it("serves HTML on tied q-values", () => {
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/markdown, text/html",
					ua: REAL_CHROME_UA,
				}),
			),
		).toBe(false);
	});

	it("serves markdown to bot user agents without an Accept hint", () => {
		mockedIsBot.mockReturnValue(true);
		expect(wantsMarkdown(docRequest("https://x.test/", { ua: "bot" }))).toBe(
			true,
		);
	});

	it("lets an explicit q=0 refusal win over the user agent", () => {
		mockedIsBot.mockReturnValue(true);
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/markdown;q=0, text/html",
					ua: "bot",
				}),
			),
		).toBe(false);
	});

	it("negotiates HEAD requests with a markdown preference", () => {
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/markdown",
					method: "HEAD",
				}),
			),
		).toBe(true);
	});

	it("never negotiates non-GET/HEAD document requests", () => {
		mockedIsBot.mockReturnValue(true);
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/markdown",
					method: "POST",
					ua: "bot",
				}),
			),
		).toBe(false);
	});
});
