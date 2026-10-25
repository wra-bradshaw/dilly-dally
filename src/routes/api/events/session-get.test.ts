import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { insertEvent } from "#/lib/db";
import { upsertAvailability } from "#/lib/server-availability";
import { createTestDb } from "#/lib/test-db";
import {
	allowNamespace,
	denyNamespace,
	stubRateLimiter,
} from "./-rate-limit-test-stub";
import {
	createSessionResponse,
	getOwnSessionResponse,
} from "./$eventId/sessions";

vi.mock("#/lib/db-env", () => ({
	getDb: () => (globalThis as unknown as Record<string, unknown>).__testDb,
}));

const event = {
	createdAt: 1_700_000_000_000,
	dates: ["2026-10-05"],
	endTime: "10:00",
	expiresAt: 1_800_000_000_000,
	id: "AbC123_-XyZ9",
	mode: "dates" as const,
	startTime: "09:00",
	timezone: "UTC",
	title: "Standup",
	weekdays: [] as number[],
};

function jsonPost(url: string, body: unknown, cookie?: string) {
	return new Request(url, {
		body: JSON.stringify(body),
		headers: {
			...(cookie ? { cookie } : {}),
			"content-type": "application/json",
		},
		method: "POST",
	});
}

beforeAll(async () => {
	const { db } = await createTestDb();
	(globalThis as unknown as Record<string, unknown>).__testDb = db;
	await insertEvent(
		(globalThis as unknown as { __testDb: Parameters<typeof insertEvent>[0] })
			.__testDb,
		event,
	);
	stubRateLimiter(allowNamespace());
});

afterEach(() => {
	stubRateLimiter(allowNamespace());
});

describe("own session GET", () => {
	it("returns name and slots for a valid session cookie", async () => {
		const db = (
			globalThis as unknown as {
				__testDb: Parameters<typeof upsertAvailability>[0];
			}
		).__testDb;
		await upsertAvailability(
			db,
			event,
			{ name: "Ada", slots: ["2026-10-05T09:00"] },
			1000,
		);
		const login = await createSessionResponse(
			event.id,
			jsonPost(`https://example.com/api/events/${event.id}/sessions`, {
				name: "Ada",
			}),
		);
		expect(login.status).toBe(201);
		const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
		const res = await getOwnSessionResponse(
			event.id,
			new Request(`https://example.com/api/events/${event.id}/sessions`, {
				headers: { cookie },
			}),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(await res.json()).toEqual({
			name: "Ada",
			slots: ["2026-10-05T09:00"],
		});
	});

	it("returns no-store 404 without a session cookie", async () => {
		const res = await getOwnSessionResponse(
			event.id,
			new Request(`https://example.com/api/events/${event.id}/sessions`),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("marks GET throttles no-store", async () => {
		stubRateLimiter(denyNamespace());
		const res = await getOwnSessionResponse(
			event.id,
			new Request(`https://example.com/api/events/${event.id}/sessions`),
		);
		expect(res.status).toBe(429);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});
});
