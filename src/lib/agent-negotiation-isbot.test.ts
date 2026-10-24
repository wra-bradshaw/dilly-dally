import { describe, expect, it } from "vitest";
import { isAgentUserAgent, wantsMarkdown } from "./agent-negotiation";

const CHROME_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
const FIREFOX_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0";
const SAFARI_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("isbot classification (pinned to installed isbot version)", () => {
	it.each([
		CHROME_UA,
		FIREFOX_UA,
		SAFARI_UA,
	])("leaves real browsers alone: %s", (ua) => {
		expect(isAgentUserAgent(ua)).toBe(false);
	});

	it("catches CLI HTTP clients", () => {
		expect(isAgentUserAgent("curl/8.4.0")).toBe(true);
		expect(isAgentUserAgent("Wget/1.21.4")).toBe(true);
		expect(isAgentUserAgent("python-requests/2.31.0")).toBe(true);
		expect(isAgentUserAgent("Go-http-client/2.0")).toBe(true);
		expect(isAgentUserAgent("axios/1.8.4")).toBe(true);
	});

	it("catches self-identified crawlers and AI bots", () => {
		expect(
			isAgentUserAgent(
				"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
			),
		).toBe(true);
		expect(isAgentUserAgent("GPTBot/1.2; +https://openai.com/gptbot")).toBe(
			true,
		);
		expect(isAgentUserAgent("ChatGPT-User/1.0; +https://openai.com/bot")).toBe(
			true,
		);
		expect(isAgentUserAgent("ClaudeBot/1.0; +https://anthropic.com")).toBe(
			true,
		);
	});

	it("catches agent tools that masquerade as generic clients", () => {
		expect(isAgentUserAgent("GoogleAgent-URLContext")).toBe(true);
		expect(isAgentUserAgent("colly - ")).toBe(true);
		expect(isAgentUserAgent("opencode/1.2.5")).toBe(true);
	});

	it("defaults a missing user agent to HTML", () => {
		expect(isAgentUserAgent(null)).toBe(false);
		expect(isAgentUserAgent("")).toBe(false);
	});
});

describe("wantsMarkdown integration", () => {
	it("serves markdown to CLI user agents without an Accept hint", () => {
		expect(
			wantsMarkdown(
				new Request("https://x.test/", {
					headers: { "user-agent": "curl/8.4.0" },
				}),
			),
		).toBe(true);
	});

	it("serves HTML to browsers with browser headers", () => {
		expect(
			wantsMarkdown(
				new Request("https://x.test/", {
					headers: {
						accept:
							"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
						"user-agent": CHROME_UA,
					},
				}),
			),
		).toBe(false);
	});
});
