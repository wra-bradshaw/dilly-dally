import { describe, expect, it } from "vitest";
import { insertEvent } from "./db";
import { upsertAvailability } from "./server-availability";
import { createEventSession } from "./server-sessions";
import { createTestDb } from "./test-db";

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

describe("session request auth", () => {
	it("authorizes matching name via valid session cookie", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Ada", password: "secret-1234", slots: [] },
			1000,
		);
		const created = await createEventSession(
			db,
			event,
			"Ada",
			"secret-1234",
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const { authorizeRequestForName } = await import("./server-session-auth");
		const authed = await authorizeRequestForName(
			db,
			event.id,
			`dd_s_${event.id}=${created.token}`,
			"Ada",
			1000,
		);
		expect(authed).toEqual({ name: "Ada", nameKey: "ada", ok: true });
	});

	it("rejects session for a different name", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(db, event, { name: "Ada", slots: [] }, 1000);
		await upsertAvailability(db, event, { name: "Bob", slots: [] }, 1000);
		const created = await createEventSession(db, event, "Ada", null, 1000);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const { authorizeRequestForName } = await import("./server-session-auth");
		const res = await authorizeRequestForName(
			db,
			event.id,
			`dd_s_${event.id}=${created.token}`,
			"Bob",
			1000,
		);
		expect(res).toEqual({ code: "mismatch", ok: false });
	});

	it("returns none when no cookie is present", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const { authorizeRequestForName } = await import("./server-session-auth");
		const res = await authorizeRequestForName(db, event.id, null, "Ada", 1000);
		expect(res).toEqual({ code: "none", ok: false });
	});
});
