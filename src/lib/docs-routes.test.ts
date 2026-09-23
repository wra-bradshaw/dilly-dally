import { describe, expect, it } from "vitest";
import {
	AGENT_GUIDE_MARKDOWN,
	agentGuideResponse,
	LLMS_TEXT,
	llmsResponse,
} from "./agent-guide";
import { openApiResponse } from "./openapi";

function securityHeadersOf(res: Response) {
	return {
		cache: res.headers.get("Cache-Control"),
		referrer: res.headers.get("Referrer-Policy"),
		sniff: res.headers.get("X-Content-Type-Options"),
	};
}

describe("agent guide response", () => {
	it("serves markdown with cache and security headers", async () => {
		const res = agentGuideResponse(new Request("https://docs.test/"));
		expect(res.headers.get("Content-Type")).toContain("text/markdown");
		expect(securityHeadersOf(res)).toEqual({
			cache: "public, max-age=3600",
			referrer: "strict-origin-when-cross-origin",
			sniff: "nosniff",
		});
		expect(await res.text()).toContain(AGENT_GUIDE_MARKDOWN.slice(0, 40));
	});

	it("rewrites HOST placeholders with the request origin", async () => {
		const res = agentGuideResponse(new Request("https://events.test/x"));
		const body = await res.text();
		expect(body).toContain("https://events.test");
		expect(body).not.toContain("HOST/api");
	});
});

describe("openapi response", () => {
	it("serves the spec with cache and security headers", async () => {
		const res = openApiResponse(new Request("https://events.test/"));
		expect(res.headers.get("Content-Type")).toContain("application/json");
		expect(securityHeadersOf(res)).toEqual({
			cache: "public, max-age=3600",
			referrer: "strict-origin-when-cross-origin",
			sniff: "nosniff",
		});
		const body = (await res.json()) as {
			openapi: string;
			servers: { url: string }[];
		};
		expect(body.openapi).toMatch(/^3\./);
		expect(body.servers).toEqual([{ url: "https://events.test" }]);
	});
});

describe("llms response", () => {
	it("serves plain text with cache and security headers", async () => {
		const res = llmsResponse();
		expect(res.headers.get("Content-Type")).toContain("text/plain");
		expect(securityHeadersOf(res)).toEqual({
			cache: "public, max-age=3600",
			referrer: "strict-origin-when-cross-origin",
			sniff: "nosniff",
		});
		expect(await res.text()).toBe(LLMS_TEXT);
	});
});
