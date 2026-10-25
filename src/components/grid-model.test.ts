import { describe, expect, it } from "vitest";
import { buildSlotUniverse } from "#/lib/time-slots";
import {
	buildColumns,
	buildGridPos,
	cellDateLabel,
	formatMarkerDate,
	formatViewerSlot,
	getDayGaps,
	gridRectangleIdsFromPos,
	splitDateHeader,
	summarizeDates,
	weekdayName,
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
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
	}).format(new Date(Date.UTC(2000, 0, 1, hh, mm)));
}

function expectedMarker(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "numeric",
		timeZone: "UTC",
		weekday: "short",
	}).format(new Date(Date.UTC(y, m - 1, d)));
}

function datesMode(
	universe: string[],
	eventTimezone = "UTC",
	viewTimezone = "UTC",
	hourCycle: "h11" | "h12" | "h23" | "h24" = "h12",
) {
	return buildColumns(universe, {
		eventTimezone,
		hourCycle,
		mode: "dates",
		viewTimezone,
	});
}

describe("buildColumns dates mode", () => {
	it("groups slots by date with labels", () => {
		const cols = datesMode(
			["2026-10-05T09:00", "2026-10-05T09:30", "2026-10-06T09:00"],
			"America/New_York",
			"America/New_York",
		);
		expect(cols.map((c) => c.key)).toEqual(["2026-10-05", "2026-10-06"]);
		expect(cols[0].cells.map((c) => c.id)).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:30",
		]);
		expect(cols[0].cells[0].label).toBe(expectedTime("09:00"));
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
	});

	it("uses single-line headers with no annotations", () => {
		const cols = datesMode(
			["2026-10-05T09:00", "2026-10-05T09:30"],
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
		const cols = datesMode(
			["2026-10-05T09:00"],
			"America/New_York",
			"Australia/Sydney",
		);
		expect(cols[0].key).toBe("2026-10-05");
		expect(cols[0].cells[0].label).toBe(expectedTime("00:00"));
		expect(cols[0].cells[0].display).toBe("2026-10-06T00:00");
	});

	it("keeps NY 9-5 x2 days complete and aligned in Melbourne time", () => {
		const universe = buildSlotUniverse({
			dates: ["2026-10-05", "2026-10-06"],
			endTime: "17:00",
			startTime: "09:00",
		});
		const cols = datesMode(universe, "America/New_York", "Australia/Melbourne");
		expect(cols.map((c) => c.key)).toEqual(["2026-10-05", "2026-10-06"]);
		const lengths = cols.map((c) => c.cells.length);
		expect(lengths).toEqual([16, 16]);
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
		const cols = datesMode(universe, "America/New_York", "Asia/Tokyo");
		expect(cols.map((c) => c.key)).toEqual(["2026-10-05", "2026-10-06"]);
		expect(cols.map((c) => c.cells.length)).toEqual([16, 16]);
		expect(cols.flatMap((c) => c.cells.map((cell) => cell.id)).sort()).toEqual(
			[...universe].sort(),
		);
	});

	it("sorts lexicographically by ISO event date", () => {
		const cols = datesMode(
			["2026-10-06T09:00", "2026-10-05T09:00"],
			"America/New_York",
			"America/New_York",
		);
		expect(cols.map((c) => c.key)).toEqual(["2026-10-05", "2026-10-06"]);
		expect(cols[0].header).toBe(formatMarkerDate("2026-10-05"));
	});

	it("keeps viewer dates correct across the NY to UTC midnight edge", () => {
		const cols = datesMode(
			[
				"2026-10-05T19:00",
				"2026-10-05T20:00",
				"2026-10-05T21:00",
				"2026-10-05T22:00",
			],
			"America/New_York",
			"UTC",
		);
		expect(cols).toHaveLength(1);
		expect(cols[0].key).toBe("2026-10-05");
		expect(cols[0].cells.map((c) => c.display)).toEqual([
			"2026-10-05T23:00",
			"2026-10-06T00:00",
			"2026-10-06T01:00",
			"2026-10-06T02:00",
		]);
		expect(cellDateLabel(cols[0].cells[0], cols[0])).toBe(
			formatMarkerDate("2026-10-05"),
		);
		expect(cellDateLabel(cols[0].cells[1], cols[0])).toBe(
			formatMarkerDate("2026-10-06"),
		);
	});

	it("returns empty for empty universe", () => {
		expect(datesMode([])).toEqual([]);
	});

	it("selects the rectangle between two cells", () => {
		const cols = datesMode([
			"2026-10-05T09:00",
			"2026-10-05T09:30",
			"2026-10-06T09:00",
			"2026-10-06T09:30",
		]);
		expect(
			rectIds(cols, "2026-10-05T09:00", "2026-10-06T09:30").sort(),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:30",
			"2026-10-06T09:00",
			"2026-10-06T09:30",
		]);
		expect(
			rectIds(cols, "2026-10-06T09:30", "2026-10-05T09:00").sort(),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:30",
			"2026-10-06T09:00",
			"2026-10-06T09:30",
		]);
	});

	it("selects a single row across columns", () => {
		const cols = datesMode([
			"2026-10-05T09:00",
			"2026-10-05T09:30",
			"2026-10-06T09:00",
			"2026-10-06T09:30",
		]);
		expect(rectIds(cols, "2026-10-05T09:00", "2026-10-06T09:00")).toEqual([
			"2026-10-05T09:00",
			"2026-10-06T09:00",
		]);
	});

	it("paints only real columns when a gap sits inside the rectangle", () => {
		const cols = datesMode([
			"2026-10-05T09:00",
			"2026-10-05T09:30",
			"2026-10-08T09:00",
			"2026-10-08T09:30",
		]);
		expect(
			rectIds(cols, "2026-10-05T09:00", "2026-10-08T09:30").sort(),
		).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:30",
			"2026-10-08T09:00",
			"2026-10-08T09:30",
		]);
	});
});

describe("buildColumns weekly mode", () => {
	it("groups slots by weekday code with numeric sort", () => {
		const cols = buildColumns(["FRI-09:00", "MON-09:00", "WED-09:30"], {
			hourCycle: "h12",
			mode: "weekly",
		});
		expect(cols.map((c) => c.key)).toEqual(["MON", "WED", "FRI"]);
		expect(cols[0].header).toBe(weekdayName(1));
		expect(cols[2].header).toBe(weekdayName(5));
	});

	it("labels cells without timezone conversion", () => {
		const cols = buildColumns(["MON-09:00", "MON-09:30"], {
			mode: "weekly",
		});
		expect(cols).toHaveLength(1);
		expect(cols[0].cells[0].display).toBe("MON-09:00");
		expect(cols[0].cells[0].label).toBe(expectedTime("09:00"));
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
		expect(cellDateLabel(cols[0].cells[0], cols[0])).toBe(cols[0].header);
	});

	it("returns empty for empty universe", () => {
		expect(buildColumns([], { mode: "weekly" })).toEqual([]);
	});

	it("labels weekly midnight across hour cycles", () => {
		const weekly = buildColumns(["MON-00:00"], {
			hourCycle: "h24",
			mode: "weekly",
		});
		expect(weekly[0].cells[0].label).toBe("24:00");
	});
});

describe("getDayGaps", () => {
	it("returns none for contiguous days", () => {
		const cols = datesMode(["2026-10-05T09:00", "2026-10-06T09:00"]);
		expect(getDayGaps(cols)).toEqual([]);
	});

	it("marks a single skipped day", () => {
		const cols = datesMode(["2026-10-05T09:00", "2026-10-07T09:00"]);
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
		const cols = datesMode([
			"2026-10-05T09:00",
			"2026-10-08T09:00",
			"2026-10-10T09:00",
		]);
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

	it("pins en-US output so server and client render identically", () => {
		expect(formatMarkerDate("2026-09-28")).toBe("Mon, 9/28");
	});
});

describe("splitDateHeader", () => {
	it("splits weekday from date", () => {
		expect(splitDateHeader("Mon, 9/28")).toEqual(["Mon", "9/28"]);
	});

	it("returns weekly headers as a single line", () => {
		expect(splitDateHeader("Mon")).toEqual(["Mon", null]);
	});
});

describe("cellDateLabel", () => {
	it("returns the viewer date for converted date cells", () => {
		const cols = datesMode(["2026-10-05T09:00"], "America/New_York", "UTC");
		expect(cellDateLabel(cols[0].cells[0], cols[0])).toBe(
			formatMarkerDate(cols[0].cells[0].display.slice(0, 10)),
		);
	});

	it("falls back to the column header for weekly cells", () => {
		const cols = buildColumns(["MON-09:00"], { mode: "weekly" });
		expect(cellDateLabel(cols[0].cells[0], cols[0])).toBe(cols[0].header);
	});
});

describe("hourCycle", () => {
	it("labels date columns in 24-hour time", () => {
		const cols = datesMode(
			["2026-10-05T13:00"],
			"America/New_York",
			"America/New_York",
			"h23",
		);
		expect(cols[0].cells[0].label).toBe("13:00");
	});

	it("labels date columns in 12-hour time by default", () => {
		const cols = datesMode(
			["2026-10-05T13:00"],
			"America/New_York",
			"America/New_York",
		);
		expect(cols[0].cells[0].label).toBe("1:00 PM");
	});

	it("labels weekly columns in 24-hour time", () => {
		const cols = buildColumns(["MON-13:00"], {
			hourCycle: "h23",
			mode: "weekly",
		});
		expect(cols[0].cells[0].label).toBe("13:00");
	});

	it("formats viewer slots in 24-hour time", () => {
		expect(
			formatViewerSlot(
				"2026-10-05T13:00",
				"America/New_York",
				"America/New_York",
				"h23",
			),
		).toBe("Oct 5, 13:00");
	});
});

describe("hourCycle variants", () => {
	it("labels weekly columns in 12-hour time by default", () => {
		const cols = buildColumns(["MON-13:00"], { mode: "weekly" });
		expect(cols[0].cells[0].label).toBe("1:00 PM");
	});

	it("formats weekly viewer slots in 24-hour time", () => {
		expect(formatViewerSlot("MON-13:00", "UTC", "UTC", "h23")).toBe(
			"Mon, 13:00",
		);
	});

	it("labels midnight across cycles", () => {
		const date = datesMode(
			["2026-10-05T00:00"],
			"America/New_York",
			"America/New_York",
			"h11",
		);
		expect(date[0].cells[0].label).toBe("0:00 AM");
		const weekly = buildColumns(["MON-00:00"], {
			hourCycle: "h24",
			mode: "weekly",
		});
		expect(weekly[0].cells[0].label).toBe("24:00");
	});
});
