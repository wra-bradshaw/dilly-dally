import { describe, expect, it } from "vitest";
import {
	type DillyEventMode,
	fetchEvent,
	insertEvent,
	toPublicEvent,
} from "./db";
import { computeExpiry, EVENT_TTL_DAYS } from "./expiry";
import { getEventDetail, upsertAvailability } from "./server-availability";
import { createTestDb } from "./test-db";
import {
	buildEventUniverse,
	buildSlotUniverse,
	buildWeeklyUniverse,
	isWeeklySlotId,
	WEEKDAY_CODES,
	weekdayCode,
} from "./time-slots";
import { availabilitySchema, createEventSchema } from "./validation";

describe("weekly createEventSchema", () => {
	it("accepts a weekly event without dates", () => {
		const parsed = createEventSchema.safeParse({
			endTime: "17:00",
			mode: "weekly",
			startTime: "09:00",
			timezone: "America/New_York",
			title: "Weekly standup",
			weekdays: [1, 3, 5],
		});
		expect(parsed.success).toBe(true);
	});

	it("keeps old date curls working without mode", () => {
		const parsed = createEventSchema.safeParse({
			dates: ["2026-10-05", "2026-10-06"],
			endTime: "17:00",
			startTime: "09:00",
			timezone: "America/New_York",
			title: "Team offsite",
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.mode).toBe("dates");
	});

	it("rejects weekly without weekdays", () => {
		expect(
			createEventSchema.safeParse({
				endTime: "17:00",
				mode: "weekly",
				startTime: "09:00",
				timezone: "UTC",
				title: "Weekly",
			}).success,
		).toBe(false);
		expect(
			createEventSchema.safeParse({
				endTime: "17:00",
				mode: "weekly",
				startTime: "09:00",
				timezone: "UTC",
				title: "Weekly",
				weekdays: [],
			}).success,
		).toBe(false);
	});

	it("rejects out-of-range and duplicate weekdays", () => {
		const base = {
			endTime: "17:00",
			mode: "weekly",
			startTime: "09:00",
			timezone: "UTC",
			title: "Weekly",
		};
		expect(
			createEventSchema.safeParse({ ...base, weekdays: [7] }).success,
		).toBe(false);
		expect(
			createEventSchema.safeParse({ ...base, weekdays: [-1] }).success,
		).toBe(false);
		expect(
			createEventSchema.safeParse({ ...base, weekdays: [1, 1] }).success,
		).toBe(false);
	});

	it("rejects dates mode without dates", () => {
		expect(
			createEventSchema.safeParse({
				endTime: "17:00",
				mode: "dates",
				startTime: "09:00",
				timezone: "UTC",
				title: "Dated",
			}).success,
		).toBe(false);
	});
});

describe("weekly availabilitySchema", () => {
	it("accepts weekly slot ids", () => {
		expect(
			availabilitySchema.safeParse({ name: "Alice", slots: ["MON-09:00"] })
				.success,
		).toBe(true);
	});

	it("still accepts date slot ids", () => {
		expect(
			availabilitySchema.safeParse({
				name: "Alice",
				slots: ["2026-10-05T09:00"],
			}).success,
		).toBe(true);
	});

	it("rejects malformed weekly slots", () => {
		expect(
			availabilitySchema.safeParse({ name: "Bob", slots: ["MON-09:07"] })
				.success,
		).toBe(false);
		expect(
			availabilitySchema.safeParse({ name: "Bob", slots: ["FUNDAY-09:00"] })
				.success,
		).toBe(false);
	});
});

describe("weekday codes", () => {
	it("maps 0=Sunday through 6=Saturday", () => {
		expect(WEEKDAY_CODES).toEqual([
			"SUN",
			"MON",
			"TUE",
			"WED",
			"THU",
			"FRI",
			"SAT",
		]);
		expect(weekdayCode(1)).toBe("MON");
		expect(weekdayCode(0)).toBe("SUN");
		expect(weekdayCode(7)).toBeNull();
	});
});

describe("weekly slot universe", () => {
	it("expands weekdays and hours into 15-min slots", () => {
		expect(
			buildWeeklyUniverse({
				endTime: "10:00",
				startTime: "09:00",
				weekdays: [1],
			}),
		).toEqual(["MON-09:00", "MON-09:15", "MON-09:30", "MON-09:45"]);
	});

	it("orders columns by weekday regardless of input order", () => {
		const slots = buildWeeklyUniverse({
			endTime: "10:00",
			startTime: "09:00",
			weekdays: [5, 1],
		});
		expect(slots.slice(0, 2)).toEqual(["MON-09:00", "MON-09:15"]);
		expect(slots.slice(4, 6)).toEqual(["FRI-09:00", "FRI-09:15"]);
	});

	it("returns empty for invalid range", () => {
		expect(
			buildWeeklyUniverse({
				endTime: "09:00",
				startTime: "09:00",
				weekdays: [1],
			}),
		).toEqual([]);
	});

	it("buildEventUniverse dispatches weekly mode", () => {
		const slots = buildEventUniverse({
			dates: [],
			endTime: "10:00",
			mode: "weekly",
			startTime: "09:00",
			weekdays: [3],
		});
		expect(slots).toEqual(["WED-09:00", "WED-09:15", "WED-09:30", "WED-09:45"]);
	});

	it("buildSlotUniverse keeps date behavior unchanged", () => {
		expect(
			buildSlotUniverse({
				dates: ["2026-10-05"],
				endTime: "10:00",
				startTime: "09:00",
			}),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
			"2026-10-05T09:30",
			"2026-10-05T09:45",
		]);
	});

	it("validates weekly slot ids", () => {
		expect(isWeeklySlotId("MON-09:15")).toBe(true);
		expect(isWeeklySlotId("SUN-00:00")).toBe(true);
		expect(isWeeklySlotId("2026-10-05T09:15")).toBe(false);
		expect(isWeeklySlotId("MON-09:07")).toBe(false);
	});
});

describe("weekly expiry", () => {
	it("expires at max window plus grace after creation", () => {
		const createdAt = new Date("2026-09-22T00:00:00.000Z").getTime();
		expect(
			computeExpiry({ createdAt, dates: [], mode: "weekly", weekdays: [1, 3] }),
		).toBe(createdAt + EVENT_TTL_DAYS * 24 * 60 * 60 * 1000);
	});
});

const weeklyMode: DillyEventMode = "weekly";
const datesMode: DillyEventMode = "dates";

const weeklyEvent = {
	createdAt: 1_700_000_000_000,
	dates: [],
	endTime: "10:00",
	expiresAt: 1_800_000_000_000,
	id: "WkLyEvEnT0001",
	mode: weeklyMode,
	startTime: "09:00",
	timezone: "UTC",
	title: "Weekly standup",
	weekdays: [1, 3],
};

const dateEvent = {
	createdAt: 1_700_000_000_000,
	dates: ["2026-10-05"],
	endTime: "10:00",
	expiresAt: 1_800_000_000_000,
	id: "AbC123_-XyZ9",
	mode: datesMode,
	startTime: "09:00",
	timezone: "UTC",
	title: "Standup",
	weekdays: [],
};

describe("weekly server availability", () => {
	it("paints weekly slots", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, weeklyEvent);
		const res = await upsertAvailability(
			db,
			weeklyEvent,
			{ name: "Alice", slots: ["MON-09:00", "WED-09:15"] },
			1000,
		);
		expect(res.ok).toBe(true);
	});

	it("rejects date slots in weekly events", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, weeklyEvent);
		expect(
			await upsertAvailability(
				db,
				weeklyEvent,
				{ name: "Alice", slots: ["2026-10-05T09:00"] },
				1000,
			),
		).toEqual({ code: "invalid_slot", ok: false });
	});

	it("rejects weekly slots in date events", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, dateEvent);
		expect(
			await upsertAvailability(
				db,
				dateEvent,
				{ name: "Alice", slots: ["MON-09:00"] },
				1000,
			),
		).toEqual({ code: "invalid_slot", ok: false });
	});

	it("computes weekly detail with universe and best times", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, weeklyEvent);
		await upsertAvailability(
			db,
			weeklyEvent,
			{ name: "Alice", slots: ["MON-09:00"] },
			1000,
		);
		await upsertAvailability(
			db,
			weeklyEvent,
			{ name: "Bob", slots: ["MON-09:00", "MON-09:15"] },
			1001,
		);
		const stored = await fetchEvent(db, weeklyEvent.id);
		const detail = await getEventDetail(db, stored ?? weeklyEvent);
		expect(detail.slotUniverse).toContain("MON-09:00");
		expect(detail.slotUniverse).toContain("WED-09:45");
		expect(detail.slotUniverse).toHaveLength(8);
		expect(detail.bestTimes[0]).toEqual({ count: 2, slot: "MON-09:00" });
		expect(detail.event.mode).toBe("weekly");
	});

	it("leaves date event universes identical", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, dateEvent);
		const stored = await fetchEvent(db, dateEvent.id);
		const detail = await getEventDetail(db, stored ?? dateEvent);
		expect(detail.slotUniverse).toHaveLength(4);
		expect(detail.event.mode).toBe("dates");
	});

	it("reads rows without mode columns as date events", () => {
		expect(
			toPublicEvent({
				createdAt: 1000,
				datesJson: JSON.stringify(["2026-10-05"]),
				endTime: "17:00",
				expiresAt: 2000,
				id: "AbC123_-XyZ9",
				startTime: "09:00",
				timezone: "UTC",
				title: "Legacy",
			})?.mode,
		).toBe("dates");
	});
});
