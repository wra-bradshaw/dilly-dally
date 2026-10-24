import { isBot } from "isbot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	acceptsMarkdown,
	isAgentUserAgent,
	markdownPreference,
	wantsMarkdown,
} from "./agent-negotiation";

vi.mock("isbot", () => ({ isBot: vi.fn() }));

const mockedIsBot = vi.mocked(isBot);

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

describe("acceptsMarkdown", () => {
	it("matches explicit markdown preferences", () => {
		expect(acceptsMarkdown("text/markdown")).toBe(true);
		expect(acceptsMarkdown("text/markdown, text/html, */*")).toBe(true);
		expect(acceptsMarkdown("text/markdown;q=1.0, text/html;q=0.7")).toBe(true);
		expect(acceptsMarkdown("text/markdown,text/html;q=0.9")).toBe(true);
	});

	it("matches the x-markdown variant some agents send", () => {
		expect(acceptsMarkdown("text/x-markdown;q=0.9, text/html;q=0.7")).toBe(
			true,
		);
	});

	it("rejects browser accept headers without markdown", () => {
		expect(
			acceptsMarkdown(
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
			),
		).toBe(false);
		expect(acceptsMarkdown("*/*")).toBe(false);
		expect(acceptsMarkdown("application/json")).toBe(false);
	});

	it("treats missing or empty headers as no preference", () => {
		expect(acceptsMarkdown(null)).toBe(false);
		expect(acceptsMarkdown("")).toBe(false);
	});

	it("respects an explicit q=0 refusal", () => {
		expect(acceptsMarkdown("text/markdown;q=0, text/html")).toBe(false);
	});
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
		expect(
			isAgentUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36",
			),
		).toBe(false);
	});

	it("passes missing user agents through to isbot", () => {
		expect(isAgentUserAgent(null)).toBe(false);
		expect(mockedIsBot).toHaveBeenCalledWith(null);
	});
});

describe("wantsMarkdown", () => {
	it("serves markdown when the client prefers it via Accept", () => {
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept: "text/markdown, text/html",
					ua: "browser",
				}),
			),
		).toBe(true);
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

	it("serves HTML to browsers with browser headers", () => {
		expect(
			wantsMarkdown(
				docRequest("https://x.test/", {
					accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					ua: "browser",
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
