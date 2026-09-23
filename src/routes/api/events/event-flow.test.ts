import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { insertEvent } from "#/lib/db";
import { createTestDb } from "#/lib/test-db";
import {
	allowNamespace,
	denyNamespace,
	stubRateLimiter,
} from "./-rate-limit-test-stub";
import {
	getOwnAvailabilityResponse,
	saveAvailability,
} from "./$eventId/availability";
import { handleGetDetail } from "./$eventId/index";
import { handleCreate } from "./index";

vi.mock("#/lib/db-env", () => ({
	getDb: () => (globalThis as unknown as Record<string, unknown>).__testDb,
}));

function futureDate(offsetDays: number): string {
	const now = new Date();
	const d = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() + offsetDays,
		),
	);
	return d.toISOString().slice(0, 10);
}

function createPayload() {
	return {
		dates: [futureDate(5)],
		endTime: "10:00",
		startTime: "09:00",
		timezone: "UTC",
		title: "Team sync",
	};
}

function jsonPost(url: string, body: unknown) {
	return new Request(url, {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
}

beforeAll(async () => {
	const { db } = await createTestDb();
	(globalThis as unknown as Record<string, unknown>).__testDb = db;
	stubRateLimiter(allowNamespace());
});

afterEach(() => {
	stubRateLimiter(allowNamespace());
});

describe("event flow", () => {
	it("creates, saves, and reads back availability", async () => {
		const created = await handleCreate(
			jsonPost("https://x.test/api/events", createPayload()),
		);
		expect(created.status).toBe(201);
		expect(created.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(created.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		const createdBody = (await created.json()) as {
			id: string;
			url: string;
		};
		expect(createdBody.url).toContain(`/e/${createdBody.id}`);

		const detailRes = await handleGetDetail(
			createdBody.id,
			new Request(`https://x.test/api/events/${createdBody.id}`),
		);
		expect(detailRes.status).toBe(200);
		const detail = (await detailRes.json()) as { slotUniverse: string[] };
		expect(detail.slotUniverse.length).toBeGreaterThan(0);
		const slots = detail.slotUniverse.slice(0, 2);

		const saved = await saveAvailability(
			jsonPost(`https://x.test/api/events/${createdBody.id}/availability`, {
				name: "Ada",
				slots,
			}),
			createdBody.id,
		);
		expect(saved.status).toBe(200);

		const own = await getOwnAvailabilityResponse(
			createdBody.id,
			new Request(
				`https://x.test/api/events/${createdBody.id}/availability?name=Ada`,
			),
		);
		expect(own.status).toBe(200);
		expect(await own.json()).toEqual({ name: "Ada", slots });
	});

	it("rejects missing names with 400", async () => {
		const res = await getOwnAvailabilityResponse(
			"AbC123_-XyZ9",
			new Request("https://x.test/api/events/x/availability"),
		);
		expect(res.status).toBe(400);
	});

	it("rejects blank names without spending rate-limit budget", async () => {
		stubRateLimiter(denyNamespace());
		const res = await getOwnAvailabilityResponse(
			"AbC123_-XyZ9",
			new Request("https://x.test/api/events/x/availability"),
		);
		expect(res.status).toBe(400);
	});

	it("maps expired events to 410", async () => {
		const db = (globalThis as unknown as Record<string, unknown>)
			.__testDb as Parameters<typeof insertEvent>[0];
		const now = Date.now();
		const expired = (id: string) => ({
			createdAt: now - 10_000,
			dates: [futureDate(5)],
			endTime: "10:00",
			expiresAt: now - 1000,
			id,
			mode: "dates" as const,
			startTime: "09:00",
			timezone: "UTC",
			title: "Old",
			weekdays: [],
		});
		await insertEvent(db, expired("EXPIRED_-012"));
		const detail = await handleGetDetail(
			"EXPIRED_-012",
			new Request("https://x.test/api/events/EXPIRED_-012"),
		);
		expect(detail.status).toBe(410);
		await insertEvent(db, expired("EXPIRED_-013"));
		const saved = await saveAvailability(
			jsonPost("https://x.test/api/events/EXPIRED_-013/availability", {
				name: "Ada",
				slots: [],
			}),
			"EXPIRED_-013",
		);
		expect(saved.status).toBe(410);
	});

	it("checks GET detail rate limit before lookup", async () => {
		stubRateLimiter(denyNamespace());
		const res = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		expect(res.status).toBe(429);
	});

	it("maps invalid ids to 404 without leaking stacks", async () => {
		const res = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		expect(res.status).toBe(404);
		expect(JSON.stringify(await res.clone().json())).not.toContain("at ");
	});

	it("rethrows non-HttpError failures", async () => {
		const prev = (globalThis as unknown as Record<string, unknown>).__testDb;
		(globalThis as unknown as Record<string, unknown>).__testDb = {
			select: () => {
				throw new Error("boom");
			},
		};
		try {
			await expect(
				handleGetDetail(
					"AbC123_-XyZ9",
					new Request("https://x.test/api/events/AbC123_-XyZ9"),
				),
			).rejects.toThrow("boom");
		} finally {
			(globalThis as unknown as Record<string, unknown>).__testDb = prev;
		}
	});

	it("rejects nameless events with 400", async () => {
		const res = await handleCreate(
			jsonPost("https://x.test/api/events", { ...createPayload(), title: "" }),
		);
		expect(res.status).toBe(400);
	});
});
