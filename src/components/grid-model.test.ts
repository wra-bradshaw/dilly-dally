import { describe, expect, it } from "vitest";
import { buildSlotUniverse } from "#/lib/time-slots";
import {
	buildColumns,
	getDayGaps,
	gridRectangleIds,
	summarizeDates,
} from "./grid-model";

describe("buildColumns", () => {
	it("groups slots by date with labels", () => {
		const cols = buildColumns(
			["2026-10-05T09:00", "2026-10-05T09:15", "2026-10-06T09:00"],
			"America/New_York",
			"America/New_York",
		);
		expect(cols.map((c) => c.date)).toEqual(["2026-10-05", "2026-10-06"]);
		expect(cols[0].cells.map((c) => c.id)).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
		]);
		expect(cols[0].cells[0].label).toBe("9:00 AM");
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
	});

	it("keys columns by event date and relabels cells in viewer time", () => {
		const cols = buildColumns(
			["2026-10-05T09:00"],
			"America/New_York",
			"Australia/Sydney",
		);
		expect(cols[0].date).toBe("2026-10-05");
		expect(cols[0].cells[0].label).toBe("12:00 AM +1d");
		expect(cols[0].cells[0].display).toBe("2026-10-06T00:00");
	});

	it("keeps NY 9-5 x2 days complete and aligned in Melbourne time", () => {
		const universe = buildSlotUniverse({
			dates: ["2026-10-05", "2026-10-06"],
			endTime: "17:00",
			startTime: "09:00",
		});
		const cols = buildColumns(
			universe,
			"America/New_York",
			"Australia/Melbourne",
		);
		expect(cols.map((c) => c.date)).toEqual(["2026-10-05", "2026-10-06"]);
		const lengths = cols.map((c) => c.cells.length);
		expect(lengths).toEqual([32, 32]);
		const total = cols.reduce((n, c) => n + c.cells.length, 0);
		expect(total).toBe(universe.length);
		const max = Math.max(...lengths);
		expect(cols[0].cells.length).toBe(max);
		for (const col of cols) {
			for (const cell of col.cells) {
				expect(cell.id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
				expect(universe).toContain(cell.id);
			}
		}
	});

	it("keeps NY 9-5 x2 days complete and aligned in Tokyo time", () => {
		const universe = buildSlotUniverse({
			dates: ["2026-10-05", "2026-10-06"],
			endTime: "17:00",
			startTime: "09:00",
		});
		const cols = buildColumns(universe, "America/New_York", "Asia/Tokyo");
		expect(cols.map((c) => c.date)).toEqual(["2026-10-05", "2026-10-06"]);
		expect(cols.map((c) => c.cells.length)).toEqual([32, 32]);
		expect(cols.flatMap((c) => c.cells.map((cell) => cell.id)).sort()).toEqual(
			[...universe].sort(),
		);
	});

	it("returns empty for empty universe", () => {
		expect(buildColumns([], "UTC", "UTC")).toEqual([]);
	});

	it("selects the rectangle between two cells", () => {
		const cols = buildColumns(
			[
				"2026-10-05T09:00",
				"2026-10-05T09:15",
				"2026-10-06T09:00",
				"2026-10-06T09:15",
			],
			"UTC",
			"UTC",
		);
		expect(
			gridRectangleIds(cols, "2026-10-05T09:00", "2026-10-06T09:15").sort(),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
			"2026-10-06T09:00",
			"2026-10-06T09:15",
		]);
		expect(
			gridRectangleIds(cols, "2026-10-06T09:15", "2026-10-05T09:00").sort(),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
			"2026-10-06T09:00",
			"2026-10-06T09:15",
		]);
	});

	it("selects a single row across columns", () => {
		const cols = buildColumns(
			[
				"2026-10-05T09:00",
				"2026-10-05T09:15",
				"2026-10-06T09:00",
				"2026-10-06T09:15",
			],
			"UTC",
			"UTC",
		);
		expect(
			gridRectangleIds(cols, "2026-10-05T09:00", "2026-10-06T09:00"),
		).toEqual(["2026-10-05T09:00", "2026-10-06T09:00"]);
	});

	it("paints only real columns when a gap sits inside the rectangle", () => {
		const cols = buildColumns(
			[
				"2026-10-05T09:00",
				"2026-10-05T09:15",
				"2026-10-08T09:00",
				"2026-10-08T09:15",
			],
			"UTC",
			"UTC",
		);
		expect(
			gridRectangleIds(cols, "2026-10-05T09:00", "2026-10-08T09:15").sort(),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
			"2026-10-08T09:00",
			"2026-10-08T09:15",
		]);
	});
});

describe("getDayGaps", () => {
	it("returns none for contiguous days", () => {
		const cols = buildColumns(
			["2026-10-05T09:00", "2026-10-06T09:00"],
			"UTC",
			"UTC",
		);
		expect(getDayGaps(cols)).toEqual([]);
	});

	it("marks a single skipped day", () => {
		const cols = buildColumns(
			["2026-10-05T09:00", "2026-10-07T09:00"],
			"UTC",
			"UTC",
		);
		expect(getDayGaps(cols)).toEqual([
			{
				afterDate: "2026-10-05",
				afterIndex: 0,
				beforeDate: "2026-10-07",
				skipped: 1,
			},
		]);
	});

	it("marks multi-day skips across several gaps", () => {
		const cols = buildColumns(
			["2026-10-05T09:00", "2026-10-08T09:00", "2026-10-10T09:00"],
			"UTC",
			"UTC",
		);
		expect(getDayGaps(cols)).toEqual([
			{
				afterDate: "2026-10-05",
				afterIndex: 0,
				beforeDate: "2026-10-08",
				skipped: 2,
			},
			{
				afterDate: "2026-10-08",
				afterIndex: 1,
				beforeDate: "2026-10-10",
				skipped: 1,
			},
		]);
	});
});

describe("summarizeDates", () => {
	it("summarizes contiguous days as one group", () => {
		expect(summarizeDates(["2026-10-05", "2026-10-06"])).toBe(
			"Showing 2 days in 1 group.",
		);
	});

	it("counts groups and skipped days for gaps", () => {
		expect(summarizeDates(["2026-10-05", "2026-10-08", "2026-10-10"])).toBe(
			"Showing 3 days in 3 groups, 3 days skipped.",
		);
	});

	it("handles a single day", () => {
		expect(summarizeDates(["2026-10-05"])).toBe("Showing 1 day in 1 group.");
	});
});
