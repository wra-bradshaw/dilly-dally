import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
	clientIp,
	contentLengthTooLarge,
	isJsonContentType,
	jsonError,
	rateLimited,
	readCappedJson,
	readGuardedJson,
	zodFields,
} from "./api-errors";
import type { components } from "./api-schema";
import { createEventSchema } from "./validation";

type ApiError = components["schemas"]["Error"];

describe("jsonError", () => {
	it("returns the agent error shape", async () => {
		const res = await jsonError(
			"gone",
			"Event has expired",
			410,
		).json<ApiError>();
		expect(res).toEqual({
			error: { code: "gone", message: "Event has expired" },
		});
	});

	it("sends anti-sniff and referrer headers without caching by default", () => {
		const res = jsonError("gone", "Event has expired", 410);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(res.headers.get("Cache-Control")).toBeNull();
	});

	it("opts into no-store for GET error responses", () => {
		const res = jsonError("not_found", "Event not found", 404, undefined, {
			noStore: true,
		});
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});
});

describe("rateLimited", () => {
	it("sets 429 with Retry-After", () => {
		const res = rateLimited(Date.now() + 61_000);
		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBeTruthy();
	});

	it("sends anti-sniff headers on 429", () => {
		const res = rateLimited(Date.now() + 61_000);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});

	it("opts into no-store for GET throttle responses", () => {
		const res = rateLimited(Date.now() + 61_000, { noStore: true });
		expect(res.status).toBe(429);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(
			rateLimited(Date.now() + 61_000).headers.get("Cache-Control"),
		).toBeNull();
	});
});

describe("readCappedJson", () => {
	it("parses a small body", async () => {
		const req = new Request("https://x.test/", {
			body: JSON.stringify({ name: "Ada" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		expect(await readCappedJson(req)).toEqual({
			ok: true,
			value: { name: "Ada" },
		});
	});

	it("rejects invalid JSON", async () => {
		const req = new Request("https://x.test/", {
			body: "{nope",
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		expect((await readCappedJson(req)).ok).toBe(false);
	});

	it("caps streamed bodies at the byte budget", async () => {
		const big = new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(300_000));
				controller.close();
			},
		});
		const req = new Request("https://x.test/", {
			body: big,
			duplex: "half",
			headers: { "content-type": "application/json" },
			method: "POST",
		} as RequestInit);
		expect(await readCappedJson(req)).toEqual({
			ok: false,
			reason: "too_large",
		});
	});

	it("caps null bodies via content-length", async () => {
		const req = new Request("https://x.test/", {
			headers: { "content-length": String(300_000) },
			method: "POST",
		});
		expect(req.body).toBeNull();
		expect(await readCappedJson(req)).toEqual({
			ok: false,
			reason: "too_large",
		});
	});

	it("treats null body without length as invalid JSON", async () => {
		const req = new Request("https://x.test/", { method: "POST" });
		expect(req.body).toBeNull();
		expect(await readCappedJson(req)).toEqual({
			ok: false,
			reason: "invalid",
		});
	});
});

describe("zodFields", () => {
	it("maps issues by path", () => {
		const parsed = createEventSchema.safeParse({
			dates: [],
			endTime: "09:00",
			startTime: "09:00",
			timezone: "UTC",
			title: "",
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const fields = zodFields(parsed.error);
			expect(Object.keys(fields).length).toBeGreaterThan(0);
		}
	});
});

describe("clientIp", () => {
	it("prefers cf-connecting-ip", () => {
		const req = new Request("https://x.test/", {
			headers: { "cf-connecting-ip": "9.9.9.9" },
		});
		expect(clientIp(req)).toBe("9.9.9.9");
	});

	it("falls back to unknown", () => {
		expect(clientIp(new Request("https://x.test/"))).toBe("unknown");
	});
});

describe("readGuardedJson bounded runtime json", () => {
	const nameSchema = z.object({ name: z.string().min(1) });

	function chunkedRequest(text: string): Request {
		const bytes = new TextEncoder().encode(text);
		const half = Math.floor(bytes.length / 2);
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(bytes.slice(0, half));
				controller.enqueue(bytes.slice(half));
				controller.close();
			},
		});
		return new Request("https://x.test/", {
			body: stream,
			duplex: "half",
			headers: { "content-type": "application/json" },
			method: "POST",
		} as RequestInit);
	}

	it("parses normal JSON through the guarded path", async () => {
		const req = new Request("https://x.test/", {
			body: JSON.stringify({ name: "Ada" }),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		const res = await readGuardedJson(req, nameSchema);
		expect(res).toEqual({ data: { name: "Ada" }, ok: true });
	});

	it("rejects oversized content-length with 413", async () => {
		const req = new Request("https://x.test/", {
			body: "{}",
			headers: {
				"content-length": String(300_000),
				"content-type": "application/json",
			},
			method: "POST",
		});
		const res = await readGuardedJson(req, nameSchema);
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.response.status).toBe(413);
	});

	it("caps chunked bodies without content-length at 256KB", async () => {
		const res = await readGuardedJson(
			chunkedRequest(`{"name":"${"x".repeat(300_000)}"}`),
			nameSchema,
		);
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.response.status).toBe(413);
	});

	it("maps malformed JSON to 400", async () => {
		const req = new Request("https://x.test/", {
			body: "{nope",
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		const res = await readGuardedJson(req, nameSchema);
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.response.status).toBe(400);
	});
});

describe("write guards", () => {
	it("rejects oversized content-length", () => {
		const big = new Request("https://x.test/", {
			headers: { "content-length": String(300_000) },
			method: "POST",
		});
		expect(contentLengthTooLarge(big)).toBe(true);
		const small = new Request("https://x.test/", {
			headers: { "content-length": "100" },
			method: "POST",
		});
		expect(contentLengthTooLarge(small)).toBe(false);
	});

	it("requires application/json content type", () => {
		const json = new Request("https://x.test/", {
			headers: { "content-type": "application/json; charset=utf-8" },
			method: "POST",
		});
		expect(isJsonContentType(json)).toBe(true);
		const form = new Request("https://x.test/", {
			headers: { "content-type": "text/plain" },
			method: "POST",
		});
		expect(isJsonContentType(form)).toBe(false);
	});
});
