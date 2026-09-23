import { describe, expect, it } from "vitest";
import { buildSlotUniverse } from "#/lib/time-slots";
import {
	buildColumns,
	buildGridPos,
	buildTimeRows,
	buildWeeklyColumns,
	formatMarkerDate,
	getDateBreaks,
	getDayGaps,
	gridRectangleIdsFromPos,
	segmentForCell,
	summarizeDates,
} from "./grid-model";

function rectIds(
	cols: Parameters<typeof gridRectangleIdsFromPos>[0],
	from: string,
	to: string,
): string[] {
	return gridRectangleIdsFromPos(cols, buildGridPos(cols), from, to);
}

function expectedTime(time: string): string {
	const [hh, mm] = time.split(":").map(Number);
	return new Intl.DateTimeFormat(undefined, {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
	}).format(new Date(Date.UTC(2000, 0, 1, hh, mm)));
}

function expectedMarker(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "numeric",
		timeZone: "UTC",
		weekday: "short",
	}).format(new Date(Date.UTC(y, m - 1, d)));
}

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
		expect(cols[0].cells[0].label).toBe(expectedTime("09:00"));
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
	});

	it("uses single-line headers with no annotations", () => {
		const cols = buildColumns(
			["2026-10-05T09:00", "2026-10-05T09:15"],
			"America/New_York",
			"America/New_York",
		);
		expect(cols[0].header).toBe(expectedMarker("2026-10-05"));
		expect(cols[0]).not.toHaveProperty("subheader");
		expect(cols[0]).not.toHaveProperty("viewerNote");
		expect(cols[0]).not.toHaveProperty("viewerDates");
		expect(cols[0].cells[0]).not.toHaveProperty("dayShift");
	});

	it("keys columns by event date and relabels cells in viewer time", () => {
		const cols = buildColumns(
			["2026-10-05T09:00"],
			"America/New_York",
			"Australia/Sydney",
		);
		expect(cols[0].date).toBe("2026-10-05");
		expect(cols[0].cells[0].label).toBe(expectedTime("00:00"));
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
			rectIds(cols, "2026-10-05T09:00", "2026-10-06T09:15").sort(),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
			"2026-10-06T09:00",
			"2026-10-06T09:15",
		]);
		expect(
			rectIds(cols, "2026-10-06T09:15", "2026-10-05T09:00").sort(),
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
		expect(rectIds(cols, "2026-10-05T09:00", "2026-10-06T09:00")).toEqual([
			"2026-10-05T09:00",
			"2026-10-06T09:00",
		]);
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
			rectIds(cols, "2026-10-05T09:00", "2026-10-08T09:15").sort(),
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

describe("formatMarkerDate", () => {
	it("formats as single-line weekday date", () => {
		expect(formatMarkerDate("2026-09-23")).toBe(expectedMarker("2026-09-23"));
		expect(formatMarkerDate("2026-10-05")).toBe(expectedMarker("2026-10-05"));
	});
});

describe("getDateBreaks", () => {
	it("marks a single date above the top cell in event time", () => {
		const cols = buildColumns(
			["2026-10-05T09:00", "2026-10-05T09:15"],
			"America/New_York",
			"America/New_York",
		);
		expect(getDateBreaks(cols[0])).toEqual([
			{
				label: expectedMarker("2026-10-05"),
				rowIndex: 0,
				viewerDate: "2026-10-05",
			},
		]);
	});

	it("marks the midnight cell when viewer time crosses days", () => {
		const cols = buildColumns(
			[
				"2026-10-05T19:00",
				"2026-10-05T20:00",
				"2026-10-05T21:00",
				"2026-10-05T22:00",
			],
			"America/New_York",
			"UTC",
		);
		expect(getDateBreaks(cols[0])).toEqual([
			{
				label: expectedMarker("2026-10-05"),
				rowIndex: 0,
				viewerDate: "2026-10-05",
			},
			{
				label: expectedMarker("2026-10-06"),
				rowIndex: 1,
				viewerDate: "2026-10-06",
			},
		]);
	});

	it("resolves the active segment for each cell", () => {
		const cols = buildColumns(
			["2026-10-05T19:00", "2026-10-05T20:00"],
			"America/New_York",
			"UTC",
		);
		const breaks = getDateBreaks(cols[0]);
		expect(segmentForCell(breaks, 0)?.viewerDate).toBe("2026-10-05");
		expect(segmentForCell(breaks, 1)?.viewerDate).toBe("2026-10-06");
	});

	it("marks weekly columns once above the top cell", () => {
		const cols = buildWeeklyColumns(["MON-09:00", "MON-09:15"]);
		expect(cols[0].header).toBe(
			new Intl.DateTimeFormat(undefined, {
				timeZone: "UTC",
				weekday: "short",
			}).format(new Date(Date.UTC(2000, 0, 3))),
		);
		expect(getDateBreaks(cols[0])).toEqual([
			{ label: cols[0].header, rowIndex: 0, viewerDate: "MON" },
		]);
		expect(buildTimeRows(cols)).toEqual([
			{
				kind: "markers",
				markers: [{ label: cols[0].header, rowIndex: 0, viewerDate: "MON" }],
			},
			{ kind: "cells", rowIndex: 0 },
			{ kind: "cells", rowIndex: 1 },
		]);
	});

	it("returns no rows for empty columns", () => {
		expect(buildTimeRows([])).toEqual([]);
	});
});

describe("buildTimeRows", () => {
	it("inserts one marker row per column in event time", () => {
		const cols = buildColumns(
			["2026-09-28T09:00", "2026-09-29T09:00"],
			"UTC",
			"UTC",
		);
		const rows = buildTimeRows(cols);
		expect(rows.filter((r) => r.kind === "markers")).toHaveLength(1);
		expect(rows[0].kind).toBe("markers");
		expect(rows[1]).toEqual({ kind: "cells", rowIndex: 0 });
	});

	it("inserts a mid-column marker while keeping rows aligned", () => {
		const cols = buildColumns(
			[
				"2026-10-05T19:00",
				"2026-10-05T20:00",
				"2026-10-05T21:00",
				"2026-10-05T22:00",
				"2026-10-06T19:00",
				"2026-10-06T20:00",
				"2026-10-06T21:00",
				"2026-10-06T22:00",
			],
			"America/New_York",
			"UTC",
		);
		const rows = buildTimeRows(cols);
		const cellRows = rows.filter((r) => r.kind === "cells");
		expect(cellRows).toHaveLength(4);
		const markerRows = rows.filter((r) => r.kind === "markers");
		expect(markerRows).toHaveLength(2);
		for (const row of rows) {
			if (row.kind === "markers") {
				expect(row.markers).toHaveLength(cols.length);
			}
		}
	});
});
