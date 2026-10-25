import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { insertEvent } from "./db";
import * as schema from "./schema";
import { upsertAvailability } from "./server-availability";
import { createTestDb, withQueryCounter } from "./test-db";

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

describe("server sessions", () => {
	it("creates and resolves a session for an unprotected name", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Ada", slots: ["2026-10-05T09:00"] },
			1000,
		);
		const { createEventSession, resolveEventSession } = await import(
			"./server-sessions"
		);
		const created = await createEventSession(db, event, "Ada", null, 1000);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		expect(created.token.length).toBeGreaterThan(20);
		const resolved = await resolveEventSession(db, created.token, 2000);
		expect(resolved).toEqual({
			eventId: event.id,
			name: "Ada",
			nameKey: "ada",
			ok: true,
		});
	});

	it("requires the correct password for protected names", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Bob", password: "s3cret-pw12", slots: [] },
			1000,
		);
		const { createEventSession } = await import("./server-sessions");
		const wrong = await createEventSession(
			db,
			event,
			"Bob",
			"nope-nope-no",
			1000,
		);
		expect(wrong).toEqual({ code: "invalid_password", ok: false });
		const right = await createEventSession(
			db,
			event,
			"Bob",
			"s3cret-pw12",
			1000,
		);
		expect(right.ok).toBe(true);
	}, 20000);

	it("rejects expired sessions and revokes on demand", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(db, event, { name: "Cara", slots: [] }, 1000);
		const { createEventSession, resolveEventSession, revokeEventSession } =
			await import("./server-sessions");
		const created = await createEventSession(db, event, "Cara", null, 1000);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const expired = await resolveEventSession(
			db,
			created.token,
			1000 + 31 * 24 * 60 * 60 * 1000,
		);
		expect(expired).toEqual({ code: "expired", ok: false });
		const fresh = await createEventSession(db, event, "Cara", null, 2000);
		expect(fresh.ok).toBe(true);
		if (!fresh.ok) return;
		await revokeEventSession(db, fresh.token);
		const gone = await resolveEventSession(db, fresh.token, 3000);
		expect(gone).toEqual({ code: "not_found", ok: false });
	});

	it("invalidates sessions when a password is claimed afterwards", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(db, event, { name: "Mallory", slots: [] }, 1000);
		const { createEventSession, resolveEventSession } = await import(
			"./server-sessions"
		);
		const created = await createEventSession(db, event, "Mallory", null, 1000);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		await upsertAvailability(
			db,
			event,
			{ name: "mallory", password: "victim-secret-1", slots: [] },
			2000,
		);
		const stale = await resolveEventSession(db, created.token, 3000);
		expect(stale).toEqual({ code: "mismatch", ok: false });
	});

	it("resolves a session with one query when no participant exists", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const { createEventSession, resolveEventSession } = await import(
			"./server-sessions"
		);
		const created = await createEventSession(db, event, "Zed", null, 1000);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const counted = withQueryCounter(db);
		const resolved = await resolveEventSession(counted.db, created.token, 2000);
		expect(resolved).toEqual({
			eventId: event.id,
			name: "Zed",
			nameKey: "zed",
			ok: true,
		});
		expect(counted.state.queries).toBe(1);
	});

	it("keeps the session when its participant row is deleted", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(db, event, { name: "Ada", slots: [] }, 1000);
		const { createEventSession, resolveEventSession } = await import(
			"./server-sessions"
		);
		const created = await createEventSession(db, event, "Ada", null, 1000);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		await db
			.delete(schema.participants)
			.where(eq(schema.participants.eventId, event.id));
		const resolved = await resolveEventSession(db, created.token, 2000);
		expect(resolved).toEqual({
			eventId: event.id,
			name: "Ada",
			nameKey: "ada",
			ok: true,
		});
	});

	it("reports expired before mismatch when both apply", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(db, event, { name: "Mallory", slots: [] }, 1000);
		const { createEventSession, resolveEventSession } = await import(
			"./server-sessions"
		);
		const created = await createEventSession(db, event, "Mallory", null, 1000);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		await upsertAvailability(
			db,
			event,
			{ name: "mallory", password: "victim-secret-1", slots: [] },
			2000,
		);
		const resolved = await resolveEventSession(
			db,
			created.token,
			1000 + 31 * 24 * 60 * 60 * 1000,
		);
		expect(resolved).toEqual({ code: "expired", ok: false });
	});

	it("invalidates a protected session when its participant row is deleted", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Bob", password: "s3cret-pw12", slots: [] },
			1000,
		);
		const { createEventSession, resolveEventSession } = await import(
			"./server-sessions"
		);
		const created = await createEventSession(
			db,
			event,
			"Bob",
			"s3cret-pw12",
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		await db
			.delete(schema.participants)
			.where(eq(schema.participants.eventId, event.id));
		const stale = await resolveEventSession(db, created.token, 2000);
		expect(stale).toEqual({ code: "mismatch", ok: false });
		const gone = await resolveEventSession(db, created.token, 3000);
		expect(gone).toEqual({ code: "not_found", ok: false });
	});
});
