import { describe, expect, it } from "vitest";
import {
	buildEventUniverse,
	buildSlotUniverse,
	computeCounts,
	findBestTimes,
	formatSlotWithDate,
	normalizeSlots,
} from "./time-slots";

describe("buildSlotUniverse", () => {
	it("expands dates and hours into 15-min slots", () => {
		const slots = buildSlotUniverse({
			dates: ["2026-10-05"],
			endTime: "10:00",
			startTime: "09:00",
		});
		expect(slots).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
			"2026-10-05T09:30",
			"2026-10-05T09:45",
		]);
	});

	it("handles multiple dates sorted", () => {
		const slots = buildSlotUniverse({
			dates: ["2026-10-06", "2026-10-05"],
			endTime: "09:00",
			startTime: "08:00",
		});
		expect(slots[0]).toBe("2026-10-05T08:00");
		expect(slots).toHaveLength(8);
	});

	it("returns empty for invalid range", () => {
		expect(
			buildSlotUniverse({
				dates: ["2026-10-05"],
				endTime: "09:00",
				startTime: "09:00",
			}),
		).toEqual([]);
	});
});

describe("buildEventUniverse", () => {
	it("defaults a modeless event to dates", () => {
		expect(
			buildEventUniverse({
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

	it("routes weekly events to weekday slots", () => {
		expect(
			buildEventUniverse({
				dates: [],
				endTime: "10:00",
				mode: "weekly",
				startTime: "09:00",
				weekdays: [1],
			}),
		).toEqual(["MON-09:00", "MON-09:15", "MON-09:30", "MON-09:45"]);
	});
});

describe("normalizeSlots", () => {
	it("dedupes and sorts", () => {
		expect(
			normalizeSlots([
				"2026-10-06T09:00",
				"2026-10-05T09:00",
				"2026-10-05T09:00",
			]),
		).toEqual(["2026-10-05T09:00", "2026-10-06T09:00"]);
	});
});

describe("computeCounts", () => {
	it("counts availability per slot with names", () => {
		const result = computeCounts(
			["2026-10-05T09:00", "2026-10-05T09:15"],
			[
				{ name: "Alice", slots: ["2026-10-05T09:00"] },
				{ name: "Bob", slots: ["2026-10-05T09:00", "2026-10-05T09:15"] },
			],
		);
		expect(result).toEqual([
			{ count: 2, names: ["Alice", "Bob"], slot: "2026-10-05T09:00" },
			{ count: 1, names: ["Bob"], slot: "2026-10-05T09:15" },
		]);
	});
});

describe("findBestTimes", () => {
	it("sorts by count desc then earliest", () => {
		const best = findBestTimes(
			[
				{ count: 1, names: ["A"], slot: "2026-10-05T09:15" },
				{ count: 2, names: ["A", "B"], slot: "2026-10-05T09:00" },
			],
			10,
		);
		expect(best[0]?.slot).toBe("2026-10-05T09:00");
	});

	it("breaks weekly ties in weekday order, not lexical order", () => {
		const best = findBestTimes(
			[
				{ count: 1, names: ["A"], slot: "FRI-09:00" },
				{ count: 1, names: ["A"], slot: "MON-09:00" },
			],
			10,
		);
		expect(best.map((b) => b.slot)).toEqual(["MON-09:00", "FRI-09:00"]);
	});
});

describe("formatSlotWithDate", () => {
	it("includes month, day, and time in the runtime locale", () => {
		const monthDay = (date: string) => {
			const [y, m, d] = date.split("-").map(Number);
			return new Intl.DateTimeFormat(undefined, {
				day: "numeric",
				month: "short",
				timeZone: "UTC",
			}).format(new Date(Date.UTC(y, m - 1, d)));
		};
		const time = (t: string) => {
			const [hh, mm] = t.split(":").map(Number);
			return new Intl.DateTimeFormat(undefined, {
				hour: "numeric",
				minute: "2-digit",
				timeZone: "UTC",
			}).format(new Date(Date.UTC(2000, 0, 1, hh, mm)));
		};
		expect(formatSlotWithDate("2026-10-06T00:00")).toBe(
			`${monthDay("2026-10-06")}, ${time("00:00")}`,
		);
		expect(formatSlotWithDate("2026-09-28T09:15")).toBe(
			`${monthDay("2026-09-28")}, ${time("09:15")}`,
		);
	});
});
