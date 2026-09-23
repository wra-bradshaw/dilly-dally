import { describe, expect, it } from "vitest";
import { buildWeeklyUniverse } from "#/lib/time-slots";
import {
	buildColumns,
	buildWeeklyColumns,
	getDayGaps,
	headerForWeekday,
	summarizeWeekdays,
} from "./grid-model";

describe("buildWeeklyColumns", () => {
	it("shows one column per weekday in fixed order", () => {
		const universe = buildWeeklyUniverse({
			endTime: "10:00",
			startTime: "09:00",
			weekdays: [5, 1, 3],
		});
		const cols = buildWeeklyColumns(universe);
		expect(cols.map((c) => c.date)).toEqual(["MON", "WED", "FRI"]);
		for (const col of cols) expect(col.cells).toHaveLength(4);
	});

	it("labels cells with weekday headers and hour times", () => {
		const cols = buildWeeklyColumns(["MON-09:00", "MON-09:15"]);
		expect(cols).toHaveLength(1);
		expect(cols[0].header).toBe("Mon");
		expect(cols[0].cells[0].label).toBe("9:00 AM");
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
	});

	it("keeps every column the same height", () => {
		const universe = buildWeeklyUniverse({
			endTime: "17:00",
			startTime: "09:00",
			weekdays: [1, 3],
		});
		const cols = buildWeeklyColumns(universe);
		expect(cols.map((c) => c.cells.length)).toEqual([32, 32]);
	});

	it("leaves date columns untouched", () => {
		const cols = buildColumns(["2026-10-05T09:00"], "UTC", "UTC");
		expect(cols.map((c) => c.date)).toEqual(["2026-10-05"]);
	});
});

describe("headerForWeekday", () => {
	it("names each weekday", () => {
		expect(headerForWeekday(1)).toEqual({
			header: "Mon",
			subheader: "Mondays",
		});
		expect(headerForWeekday(0)).toEqual({
			header: "Sun",
			subheader: "Sundays",
		});
	});
});

describe("summarizeWeekdays", () => {
	it("summarizes contiguous weekdays as one group", () => {
		expect(summarizeWeekdays([1, 2, 3])).toBe("Showing 3 weekdays in 1 group.");
	});

	it("counts groups and skipped days for gaps", () => {
		expect(summarizeWeekdays([1, 3, 5])).toBe(
			"Showing 3 weekdays in 3 groups, 2 days skipped.",
		);
	});

	it("handles a single weekday", () => {
		expect(summarizeWeekdays([1])).toBe("Showing 1 weekday in 1 group.");
	});
});

describe("weekly grid gaps", () => {
	it("reports no date gaps for weekly columns", () => {
		const cols = buildWeeklyColumns(["MON-09:00", "WED-09:00"]);
		expect(getDayGaps(cols)).toEqual([]);
	});
});
