import { describe, expect, it } from "vitest";
import worker, { needsDocumentHeaders, withDocumentHeaders } from "./worker";

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

describe("worker exports", () => {
	it("keeps the scheduled export intact", () => {
		expect(typeof worker.scheduled).toBe("function");
		expect(typeof worker.fetch).toBe("function");
	});
});
