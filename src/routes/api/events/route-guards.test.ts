import { env } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readGuardedJson } from "#/lib/api-errors";
import { insertEvent } from "#/lib/db";
import { createTestDb, withQueryCounter } from "#/lib/test-db";
import { availabilitySchema } from "#/lib/validation";
import {
	allowRateLimit,
	denyRateLimit,
	stubRateLimiters,
} from "./-rate-limit-test-stub";
import {
	getOwnAvailabilityResponse,
	saveAvailability,
} from "./$eventId/availability";
import { handleGetDetail } from "./$eventId/index";
import {
	createSessionResponse,
	deleteSessionResponse,
} from "./$eventId/sessions";
import { handleCreate } from "./index";

vi.mock("#/lib/db-env", () => ({
	getDb: () => (globalThis as unknown as Record<string, unknown>).__testDb,
}));

beforeAll(async () => {
	const { db } = await createTestDb();
	(globalThis as unknown as Record<string, unknown>).__testDb = db;
	await insertEvent(
		(globalThis as unknown as { __testDb: Parameters<typeof insertEvent>[0] })
			.__testDb,
		{
			createdAt: 1_700_000_000_000,
			dates: ["2026-10-05"],
			endTime: "10:00",
			expiresAt: 1_800_000_000_000,
			id: "AbC123_-XyZ9",
			mode: "dates",
			startTime: "09:00",
			timezone: "UTC",
			title: "Standup",
			weekdays: [],
		},
	);
	stubRateLimiters(allowRateLimit());
});

afterEach(() => {
	const record = env as unknown as Record<string, unknown>;
	delete record.READ_LIMITER;
	delete record.AVAIL_WRITE_LIMITER;
	delete record.CREATE_EVENT_LIMITER;
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
		stubRateLimiters(denyRateLimit());
		const res = await handleCreate(postRequest({ title: "x" }, "text/plain"));
		expect(res.status).toBe(429);
	});

	it("rejects oversized content-length with 413", async () => {
		stubRateLimiters(allowRateLimit());
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
		stubRateLimiters(allowRateLimit());
		const res = await handleCreate(postRequest("{}", "text/plain"));
		expect(res.status).toBe(415);
	});

	it("caps chunked bodies without content-length at 256KB", async () => {
		stubRateLimiters(allowRateLimit());
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
		stubRateLimiters(denyRateLimit());
		const res = await saveAvailability(
			postRequest({ name: "Ada" }, "text/plain"),
			eventId,
		);
		expect(res.status).toBe(429);
	});

	it("burns write budget on blank bodies to throttle floods", async () => {
		stubRateLimiters(denyRateLimit());
		const res = await saveAvailability(
			postRequest({ name: "   ", slots: [] }, "application/json"),
			eventId,
		);
		expect(res.status).toBe(429);
	});

	it("rejects oversized content-length with 413", async () => {
		stubRateLimiters(allowRateLimit());
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
		stubRateLimiters(allowRateLimit());
		const res = await saveAvailability(
			postRequest("{}", "text/plain"),
			eventId,
		);
		expect(res.status).toBe(415);
	});

	it("rejects cross-origin writes without loading the event", async () => {
		stubRateLimiters(allowRateLimit());
		const holder = globalThis as unknown as {
			__testDb: Parameters<typeof insertEvent>[0];
		};
		const raw = holder.__testDb;
		const counted = withQueryCounter(raw);
		holder.__testDb = counted.db;
		try {
			const res = await saveAvailability(
				new Request(`https://x.test/api/events/${eventId}/availability`, {
					body: JSON.stringify({ name: "Ada", slots: [] }),
					headers: {
						"content-type": "application/json",
						origin: "https://evil.test",
					},
					method: "PUT",
				}),
				eventId,
			);
			expect(res.status).toBe(403);
			expect(counted.state.queries).toBe(0);
		} finally {
			holder.__testDb = raw;
		}
	});

	it("reports rate limits before cross-origin rejections", async () => {
		stubRateLimiters(denyRateLimit());
		const res = await saveAvailability(
			new Request(`https://x.test/api/events/${eventId}/availability`, {
				body: JSON.stringify({ name: "Ada", slots: [] }),
				headers: {
					"content-type": "application/json",
					origin: "https://evil.test",
				},
				method: "PUT",
			}),
			eventId,
		);
		expect(res.status).toBe(429);
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
		stubRateLimiters(allowRateLimit());
		const res = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("serves error JSON without leaking stack traces", async () => {
		stubRateLimiters(allowRateLimit());
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
		stubRateLimiters(allowRateLimit());
		const res = await getOwnAvailabilityResponse(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/x/availability?name=Ada"),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("marks GET throttles no-store", async () => {
		stubRateLimiters(denyRateLimit());
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
		stubRateLimiters({
			limit: async () => {
				throw new Error("rate limiter must not run for blank names");
			},
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
		stubRateLimiters(allowRateLimit());
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
		stubRateLimiters(allowRateLimit());
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

describe("live-event precedence", () => {
	it("reports missing events before malformed availability bodies", async () => {
		stubRateLimiters(allowRateLimit());
		const res = await saveAvailability(
			postRequest({ name: "Ada" }, "text/plain"),
			"!!!not-an-id!!!",
		);
		expect(res.status).toBe(404);
	});

	it("reports missing events before malformed session bodies", async () => {
		stubRateLimiters(allowRateLimit());
		const res = await createSessionResponse(
			"!!!not-an-id!!!",
			postRequest({ name: "Ada" }, "text/plain"),
		);
		expect(res.status).toBe(404);
	});

	it("reports missing events on session logout before clearing cookies", async () => {
		stubRateLimiters(allowRateLimit());
		const res = await deleteSessionResponse(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!/sessions", {
				method: "DELETE",
			}),
		);
		expect(res.status).toBe(404);
	});
});
