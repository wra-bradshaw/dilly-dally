import { describe, expect, it, vi } from "vitest";
import {
	deleteEvent,
	fetchEvent,
	insertEvent,
	listParticipants,
	parseSlotsJson,
	purgeExpired,
	runAsBatch,
	type DrizzleDb,
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
	mode: "dates" as const,
	startTime: "09:00",
	timezone: "UTC",
	title: "Test",
	weekdays: [] as number[],
};

describe("toPublicEvent", () => {
	it("maps a drizzle row", () => {
		const event = toPublicEvent({
			createdAt: 1000,
			datesJson: JSON.stringify(["2026-10-05"]),
			endTime: "17:00",
			expiresAt: 2000,
			id: "AbC123_-XyZ9",
			mode: "dates",
			startTime: "09:00",
			timezone: "UTC",
			title: "Test",
			weekdaysJson: JSON.stringify([]),
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
				mode: "dates",
				startTime: "09:00",
				timezone: "UTC",
				title: "t",
				weekdaysJson: null,
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
			mode: "dates",
			startTime: "09:00",
			timezone: "UTC",
			title: "Other",
			weekdaysJson: JSON.stringify([]),
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

describe("runAsBatch", () => {
	it("sends every query in one batch call when supported", async () => {
		const batch = vi.fn(async () => []);
		const db = { batch } as unknown as DrizzleDb;
		const first = { tag: "first" };
		const second = { tag: "second" };
		await runAsBatch(db, [first, second]);
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch).toHaveBeenCalledWith([first, second]);
	});

	it("runs queries in order when batch is unavailable", async () => {
		const db = {} as unknown as DrizzleDb;
		const order: string[] = [];
		const query = (name: string) => ({
			then: (onFulfilled: (value: string) => unknown) => {
				order.push(name);
				return Promise.resolve(name).then(onFulfilled);
			},
		});
		await runAsBatch(db, [query("a"), query("b"), query("c")]);
		expect(order).toEqual(["a", "b", "c"]);
	});

	it("propagates batch failures", async () => {
		const batch = vi.fn(async () => {
			throw new Error("batch blew up");
		});
		const db = { batch } as unknown as DrizzleDb;
		await expect(runAsBatch(db, [{}])).rejects.toThrow("batch blew up");
	});

	it("propagates sequential failures", async () => {
		const db = {} as unknown as DrizzleDb;
		const failing = {
			then: () => {
				throw new Error("query blew up");
			},
		};
		await expect(runAsBatch(db, [failing])).rejects.toThrow("query blew up");
	});
});
