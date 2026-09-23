import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import { readGuardedJson } from "#/lib/api-errors";
import { availabilitySchema } from "#/lib/validation";
import {
	getOwnAvailabilityResponse,
	saveAvailability,
} from "./$eventId/availability";
import { handleGetDetail } from "./$eventId/index";
import { handleCreate } from "./index";
import {
	allowNamespace,
	denyNamespace,
	stubRateLimiter,
} from "./rate-limit-test-stub";

afterEach(() => {
	delete (env as unknown as Record<string, unknown>).RATE_LIMITER;
});

function postRequest(body: unknown, contentType = "application/json") {
	return new Request("https://x.test/api/events", {
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: { "content-type": contentType },
		method: "POST",
	});
}

describe("create guards", () => {
	it("checks the rate limit before parsing or validating", async () => {
		stubRateLimiter(denyNamespace());
		const res = await handleCreate(postRequest({ title: "x" }, "text/plain"));
		expect(res.status).toBe(429);
	});

	it("rejects oversized content-length with 413", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleCreate(
			new Request("https://x.test/api/events", {
				body: "{}",
				headers: {
					"content-length": String(300_000),
					"content-type": "application/json",
				},
				method: "POST",
			}),
		);
		expect(res.status).toBe(413);
	});

	it("rejects non-JSON content with 415", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleCreate(postRequest("{}", "text/plain"));
		expect(res.status).toBe(415);
	});

	it("caps chunked bodies without content-length at 256KB", async () => {
		stubRateLimiter(allowNamespace());
		const big = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('{"title":"'));
				controller.enqueue(new Uint8Array(300_000));
				controller.close();
			},
		});
		const res = await handleCreate(
			new Request("https://x.test/api/events", {
				body: big,
				duplex: "half",
				headers: { "content-type": "application/json" },
				method: "POST",
			} as RequestInit),
		);
		expect(res.status).toBe(413);
	});
});

describe("availability write guards", () => {
	const eventId = "AbC123_-XyZ9";

	it("checks the rate limit before parsing or validating", async () => {
		stubRateLimiter(denyNamespace());
		const res = await saveAvailability(
			postRequest({ name: "Ada" }, "text/plain"),
			eventId,
		);
		expect(res.status).toBe(429);
	});

	it("rejects oversized content-length with 413", async () => {
		stubRateLimiter(allowNamespace());
		const res = await saveAvailability(
			new Request("https://x.test/api/events/x/availability", {
				body: "{}",
				headers: {
					"content-length": String(300_000),
					"content-type": "application/json",
				},
				method: "PUT",
			}),
			eventId,
		);
		expect(res.status).toBe(413);
	});

	it("rejects non-JSON content with 415", async () => {
		stubRateLimiter(allowNamespace());
		const res = await saveAvailability(
			postRequest("{}", "text/plain"),
			eventId,
		);
		expect(res.status).toBe(415);
	});
});

describe("guarded JSON adapter", () => {
	it("prefers 413 over 415 when both apply", async () => {
		const res = await readGuardedJson(
			new Request("https://x.test/api/events/x/availability", {
				body: "{}",
				headers: {
					"content-length": String(300_000),
					"content-type": "text/plain",
				},
				method: "PUT",
			}),
			availabilitySchema,
		);
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.response.status).toBe(413);
	});

	it("maps non-JSON content to 415", async () => {
		const res = await readGuardedJson(
			postRequest("{}", "text/plain"),
			availabilitySchema,
		);
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.response.status).toBe(415);
	});

	it("maps invalid JSON to 400", async () => {
		const res = await readGuardedJson(
			postRequest("{nope", "application/json"),
			availabilitySchema,
		);
		expect(res.ok).toBe(false);
		if (!res.ok) expect(res.response.status).toBe(400);
	});

	it("maps validation failure to 400 with fields", async () => {
		const res = await readGuardedJson(
			postRequest({ name: "" }, "application/json"),
			availabilitySchema,
		);
		expect(res.ok).toBe(false);
		if (!res.ok) {
			expect(res.response.status).toBe(400);
			const body = (await res.response.json()) as {
				error: { fields?: Record<string, string[]> };
			};
			expect(body.error.fields).toBeDefined();
		}
	});
});

describe("detail GET errors", () => {
	it("returns no-store on terminal error responses", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("serves error JSON without leaking stack traces", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		const body = (await res.json()) as {
			error: { code: string; message: string };
		};
		expect(body.error.code).toBe("not_found");
		expect(JSON.stringify(body)).not.toContain("at ");
	});

	it("marks own-availability errors no-store", async () => {
		stubRateLimiter(allowNamespace());
		const res = await getOwnAvailabilityResponse(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/x/availability?name=Ada"),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("marks GET throttles no-store", async () => {
		stubRateLimiter(denyNamespace());
		const detail = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		expect(detail.status).toBe(429);
		expect(detail.headers.get("Cache-Control")).toBe("no-store");
		const own = await getOwnAvailabilityResponse(
			"AbC123_-XyZ9",
			new Request("https://x.test/api/events/x/availability?name=Ada"),
		);
		expect(own.status).toBe(429);
		expect(own.headers.get("Cache-Control")).toBe("no-store");
	});

	it("rejects blank names before the rate limit so junk burns no budget", async () => {
		stubRateLimiter({
			getByName: (_key: string) => ({
				check: async () => {
					throw new Error("rate limiter must not run for blank names");
				},
			}),
		});
		for (const url of [
			"https://x.test/api/events/x/availability",
			"https://x.test/api/events/x/availability?name=%20%20",
		]) {
			const res = await getOwnAvailabilityResponse(
				"AbC123_-XyZ9",
				new Request(url),
			);
			expect(res.status).toBe(400);
		}
	});
});

describe("guard response headers", () => {
	it("sends nosniff and referrer on POST guard errors", async () => {
		stubRateLimiter(allowNamespace());
		const bad = [
			await handleCreate(
				new Request("https://x.test/api/events", {
					body: "{}",
					headers: {
						"content-length": String(300_000),
						"content-type": "application/json",
					},
					method: "POST",
				}),
			),
			await handleCreate(postRequest("{}", "text/plain")),
			await handleCreate(postRequest("{nope", "application/json")),
		];
		expect(bad.map((r) => r.status)).toEqual([413, 415, 400]);
		for (const res of bad) {
			expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
			expect(res.headers.get("Referrer-Policy")).toBe(
				"strict-origin-when-cross-origin",
			);
		}
	});

	it("sends nosniff and referrer on write guard errors", async () => {
		stubRateLimiter(allowNamespace());
		const res = await saveAvailability(
			postRequest({ name: "Ada" }, "text/plain"),
			"AbC123_-XyZ9",
		);
		expect(res.status).toBe(415);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
	});
});
