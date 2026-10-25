import { describe, expect, it } from "vitest";
import { buildWeeklyUniverse } from "#/lib/time-slots";
import {
	buildColumns,
	cellDateLabel,
	getDayGaps,
	summarizeWeekdays,
	weekdayName,
} from "./grid-model";

function weeklyMode(
	universe: string[],
	hourCycle: "h11" | "h12" | "h23" | "h24" = "h12",
) {
	return buildColumns(universe, { hourCycle, mode: "weekly" });
}

describe("buildColumns weekly mode", () => {
	it("shows one column per weekday in fixed order", () => {
		const universe = buildWeeklyUniverse({
			endTime: "10:00",
			startTime: "09:00",
			weekdays: [5, 1, 3],
		});
		const cols = weeklyMode(universe);
		expect(cols.map((c) => c.key)).toEqual(["MON", "WED", "FRI"]);
		for (const col of cols) expect(col.cells).toHaveLength(2);
	});

	it("labels cells with weekday headers and hour times", () => {
		const cols = weeklyMode(["MON-09:00", "MON-09:30"]);
		expect(cols).toHaveLength(1);
		expect(cols[0].header).toBe("Mon");
		expect(cols[0].cells[0].label).toBe(
			new Intl.DateTimeFormat("en-US", {
				hour: "numeric",
				minute: "2-digit",
				timeZone: "UTC",
			}).format(new Date(Date.UTC(2000, 0, 1, 9, 0))),
		);
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
	});

	it("keeps every column the same height", () => {
		const universe = buildWeeklyUniverse({
			endTime: "17:00",
			startTime: "09:00",
			weekdays: [1, 3],
		});
		const cols = weeklyMode(universe);
		expect(cols.map((c) => c.cells.length)).toEqual([16, 16]);
	});

	it("leaves date columns untouched", () => {
		const cols = buildColumns(["2026-10-05T09:00"], {
			eventTimezone: "UTC",
			mode: "dates",
			viewTimezone: "UTC",
		});
		expect(cols.map((c) => c.key)).toEqual(["2026-10-05"]);
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
		const cols = weeklyMode(["MON-09:00", "WED-09:00"]);
		expect(getDayGaps(cols)).toEqual([]);
	});
});

describe("weekly columns parity", () => {
	it("sorts unsorted weekday input into numeric order", () => {
		const cols = weeklyMode(["SUN-10:00", "MON-09:00", "SAT-09:00"]);
		expect(cols.map((c) => c.key)).toEqual(["SUN", "MON", "SAT"]);
	});

	it("uses weekday headers for every code", () => {
		const cols = weeklyMode(["TUE-09:00", "THU-09:00"]);
		expect(cols[0].header).toBe(weekdayName(2));
		expect(cols[1].header).toBe(weekdayName(4));
	});

	it("marks hour starts from wall minutes", () => {
		const cols = weeklyMode(["MON-10:00", "MON-10:30"]);
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
	});

	it("keeps cell display equal to slot id with viewer date fallback", () => {
		const cols = weeklyMode(["WED-14:00"]);
		expect(cols[0].cells[0].display).toBe("WED-14:00");
		expect(cellDateLabel(cols[0].cells[0], cols[0])).toBe(cols[0].header);
	});

	it("returns empty for an empty weekly universe", () => {
		expect(weeklyMode([])).toEqual([]);
	});
});
