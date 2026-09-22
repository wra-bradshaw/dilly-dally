import { describe, expect, it } from "vitest";
import {
	deleteEvent,
	fetchEvent,
	insertEvent,
	listParticipants,
	parseSlotsJson,
	purgeExpired,
	toPublicEvent,
} from "./db";
import { events, participants } from "./schema";
import { createTestDb } from "./test-db";

const base = {
	createdAt: 1_700_000_000_000,
	dates: ["2026-10-05", "2026-10-06"],
	endTime: "10:00",
	expiresAt: 1_800_000_000_000,
	id: "AbC123_-XyZ9",
	startTime: "09:00",
	timezone: "UTC",
	title: "Test",
};

describe("toPublicEvent", () => {
	it("maps a drizzle row", () => {
		const event = toPublicEvent({
			createdAt: 1000,
			datesJson: JSON.stringify(["2026-10-05"]),
			endTime: "17:00",
			expiresAt: 2000,
			id: "AbC123_-XyZ9",
			startTime: "09:00",
			timezone: "UTC",
			title: "Test",
		});
		expect(event?.dates).toEqual(["2026-10-05"]);
	});

	it("returns null for malformed datesJson", () => {
		expect(
			toPublicEvent({
				createdAt: 1,
				datesJson: "not-json",
				endTime: "17:00",
				expiresAt: 2,
				id: "x",
				startTime: "09:00",
				timezone: "UTC",
				title: "t",
			}),
		).toBeNull();
	});
});

describe("parseSlotsJson", () => {
	it("returns [] for malformed json", () => {
		expect(parseSlotsJson("nope")).toEqual([]);
		expect(parseSlotsJson(JSON.stringify({ a: 1 }))).toEqual([]);
	});
});

describe("event persistence", () => {
	it("inserts and fetches an event", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, base);
		expect(await fetchEvent(db, base.id)).toEqual(base);
		expect(await fetchEvent(db, "missing-miss1")).toBeNull();
	});

	it("deletes event and participants", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, base);
		await db.insert(events).values({
			createdAt: 1,
			datesJson: "[]",
			endTime: "10:00",
			expiresAt: 2,
			id: "other-id-001",
			startTime: "09:00",
			timezone: "UTC",
			title: "Other",
		});
		await deleteEvent(db, base.id);
		expect(await fetchEvent(db, base.id)).toBeNull();
		expect(await listParticipants(db, base.id)).toEqual([]);
	});

	it("purges expired events", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, { ...base, expiresAt: 1000 });
		await insertEvent(db, { ...base, expiresAt: 9999, id: "live-id-00001" });
		expect(await purgeExpired(db, 2000)).toBe(1);
		expect(await fetchEvent(db, base.id)).toBeNull();
		expect(await fetchEvent(db, "live-id-00001")).not.toBeNull();
	});

	it("purge cascades to participants via FK", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, { ...base, expiresAt: 1000 });
		await db.insert(participants).values({
			eventId: base.id,
			nameDisplay: "Alice",
			nameKey: "alice",
			passwordHash: null,
			slotsJson: "[]",
			updatedAt: 1000,
		});
		expect(await purgeExpired(db, 2000)).toBe(1);
		expect(await listParticipants(db, base.id)).toEqual([]);
	});
});
