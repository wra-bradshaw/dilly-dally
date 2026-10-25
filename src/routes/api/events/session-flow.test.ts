import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { insertEvent } from "#/lib/db";
import { upsertAvailability } from "#/lib/server-availability";
import { createTestDb } from "#/lib/test-db";
import { allowRateLimit, stubRateLimiters } from "./-rate-limit-test-stub";
import { getOwnAvailabilityResponse } from "./$eventId/availability";
import {
	createSessionResponse,
	deleteSessionResponse,
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
	stubRateLimiters(allowRateLimit());
});

afterEach(() => {
	stubRateLimiters(allowRateLimit());
});

describe("session flow", () => {
	it("authorizes protected availability via session cookie without password", async () => {
		const db = (
			globalThis as unknown as {
				__testDb: Parameters<typeof upsertAvailability>[0];
			}
		).__testDb;
		await upsertAvailability(
			db,
			event,
			{ name: "Ada", password: "secret-1234", slots: ["2026-10-05T09:00"] },
			1000,
		);
		const login = await createSessionResponse(
			event.id,
			jsonPost(`https://example.com/api/events/${event.id}/sessions`, {
				name: "Ada",
				password: "secret-1234",
			}),
		);
		expect(login.status).toBe(201);
		const setCookie = login.headers.get("set-cookie");
		expect(setCookie).toContain("HttpOnly");
		expect(setCookie).toContain(`dd_s_${event.id}=`);
		expect(login.headers.get("Cache-Control")).toBe("no-store");
		const cookie = setCookie?.split(";")[0] ?? "";
		const own = await getOwnAvailabilityResponse(
			event.id,
			new Request(
				`https://example.com/api/events/${event.id}/availability?name=Ada`,
				{
					headers: { cookie },
				},
			),
		);
		expect(own.status).toBe(200);
		expect(await own.json()).toEqual({
			name: "Ada",
			slots: ["2026-10-05T09:00"],
		});
	});

	it("clears the session cookie on logout", async () => {
		const res = await deleteSessionResponse(
			event.id,
			new Request(`https://example.com/api/events/${event.id}/sessions`, {
				method: "DELETE",
			}),
		);
		expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
		expect(res.headers.get("set-cookie")).toContain(`dd_s_${event.id}=`);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});
});
