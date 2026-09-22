import { describe, expect, it } from "vitest";
import {
	buildSlotUniverse,
	computeCounts,
	findBestTimes,
	isValidSlotId,
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

describe("isValidSlotId", () => {
	it("accepts quarter-hour slots", () => {
		expect(isValidSlotId("2026-10-05T09:15")).toBe(true);
		expect(isValidSlotId("2026-10-05T09:00")).toBe(true);
	});

	it("rejects off-quarter and malformed", () => {
		expect(isValidSlotId("2026-10-05T09:07")).toBe(false);
		expect(isValidSlotId("2026-10-05 09:00")).toBe(false);
		expect(isValidSlotId("not-a-slot")).toBe(false);
		expect(isValidSlotId("2026-13-40T25:00")).toBe(false);
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
});
