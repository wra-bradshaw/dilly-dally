import handler from "@tanstack/react-start/server-entry";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { purgeExpired } from "./lib/db";
import worker, { needsDocumentHeaders, withDocumentHeaders } from "./worker";

vi.mock("./lib/db", () => ({ purgeExpired: vi.fn() }));
vi.mock("drizzle-orm/d1", () => ({
	drizzle: vi.fn(() => ({ mocked: true }) as never),
}));
vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: vi.fn() },
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("needsDocumentHeaders", () => {
	it("matches HTML regardless of content-type case", () => {
		expect(needsDocumentHeaders("text/html; charset=utf-8")).toBe(true);
		expect(needsDocumentHeaders("Text/HTML; charset=utf-8")).toBe(true);
		expect(needsDocumentHeaders("TEXT/HTML")).toBe(true);
	});

	it("leaves JSON and missing content types untouched", () => {
		expect(needsDocumentHeaders("application/json")).toBe(false);
		expect(needsDocumentHeaders(null)).toBe(false);
		expect(needsDocumentHeaders("")).toBe(false);
	});
});

describe("withDocumentHeaders", () => {
	it("sets DENY, nosniff, and referrer on HTML", () => {
		const res = withDocumentHeaders(
			new Response("<html></html>", {
				headers: { "content-type": "text/html" },
			}),
		);
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
	});

	it("returns JSON responses untouched", () => {
		const res = new Response("{}", {
			headers: { "content-type": "application/json" },
		});
		expect(withDocumentHeaders(res)).toBe(res);
	});

	it("preserves status, statusText, and body through the re-wrap", async () => {
		const res = withDocumentHeaders(
			new Response("<html></html>", {
				headers: { "content-type": "Text/HTML" },
				status: 404,
				statusText: "Not Found",
			}),
		);
		expect(res.status).toBe(404);
		expect(res.statusText).toBe("Not Found");
		expect(await res.text()).toBe("<html></html>");
	});
});

describe("worker fetch", () => {
	it("passes the request through and adds document headers to HTML", async () => {
		vi.mocked(handler.fetch).mockResolvedValue(
			new Response("<html></html>", {
				headers: { "content-type": "text/html" },
			}),
		);
		const request = new Request("https://x.test/");
		const res = await worker.fetch(request);
		expect(handler.fetch).toHaveBeenCalledTimes(1);
		expect(handler.fetch).toHaveBeenCalledWith(request);
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(await res.text()).toBe("<html></html>");
	});

	it("leaves JSON from the server handler untouched", async () => {
		const inner = new Response("{}", {
			headers: { "content-type": "application/json" },
		});
		vi.mocked(handler.fetch).mockResolvedValue(inner);
		const res = await worker.fetch(new Request("https://x.test/api/events"));
		expect(res).toBe(inner);
	});
});

describe("worker scheduled", () => {
	it("purges expired events with the D1 database", async () => {
		const env = { DB: { scheduled: true } } as unknown as Env;
		await worker.scheduled(
			{} as ScheduledController,
			env,
			{} as ExecutionContext,
		);
		expect(drizzle).toHaveBeenCalledTimes(1);
		expect(purgeExpired).toHaveBeenCalledTimes(1);
		expect(vi.mocked(purgeExpired).mock.calls[0]?.[0]).toEqual({
			mocked: true,
		});
		expect(typeof vi.mocked(purgeExpired).mock.calls[0]?.[1]).toBe("number");
	});

	it("keeps fetch and scheduled exports with the expected arity", () => {
		expect(typeof worker.fetch).toBe("function");
		expect(worker.scheduled.length).toBe(3);
	});
});
