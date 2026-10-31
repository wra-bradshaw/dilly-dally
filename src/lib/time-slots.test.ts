import { describe, expect, it } from "vitest";
import {
	allTimezones,
	browserTimezone,
	buildEventUniverse,
	buildSlotUniverse,
	computeCounts,
	findBestTimes,
	formatSlotLabel,
	formatSlotRange,
	formatSlotWithDate,
	formatSlotWithDateRange,
	formatTimeRange,
	formatViewerSlotRange,
	formatWeeklySlot,
	formatWeeklySlotRange,
	normalizeSlots,
	systemHourCycle,
} from "./time-slots";

describe("browserTimezone", () => {
	it("returns a non-empty zone name", () => {
		expect(browserTimezone()).toMatch(/.+/);
	});
});

describe("formatSlotLabel", () => {
	it("pins en-US output so server and client render identically", () => {
		expect(formatSlotLabel("2026-01-01T09:00")).toBe("9:00 AM");
	});

	it("defaults to 12-hour labels", () => {
		expect(formatSlotLabel("2026-01-01T13:00", "h12")).toBe("1:00 PM");
	});

	it("formats 24-hour labels when the system uses 24-hour time", () => {
		expect(formatSlotLabel("2026-01-01T09:00", "h23")).toBe("09:00");
		expect(formatSlotLabel("2026-01-01T13:00", "h23")).toBe("13:00");
		expect(formatSlotLabel("2026-01-01T00:00", "h23")).toBe("00:00");
	});
});

describe("systemHourCycle", () => {
	it("returns a valid hour cycle", () => {
		expect(["h11", "h12", "h23", "h24"]).toContain(systemHourCycle());
	});
});

describe("formatSlotWithDate", () => {
	it("respects the hour cycle", () => {
		expect(formatSlotWithDate("2026-01-01T13:00", "h23")).toBe("1/1, 13:00");
		expect(formatSlotWithDate("2026-01-01T13:00", "h12")).toBe("1/1, 1:00 PM");
	});
});

describe("formatWeeklySlot", () => {
	it("respects the hour cycle", () => {
		expect(formatWeeklySlot("MON-13:00", "h23")).toBe("Mon, 13:00");
		expect(formatWeeklySlot("MON-13:00", "h12")).toBe("Mon, 1:00 PM");
	});
});

describe("formatTimeRange", () => {
	it("joins 24-hour start and end with a hyphen", () => {
		expect(formatTimeRange("17:00", "h23")).toBe("17:00-17:30");
		expect(formatTimeRange("00:00", "h23")).toBe("00:00-00:30");
		expect(formatTimeRange("23:30", "h23")).toBe("23:30-00:00");
	});

	it("collapses the meridiem when start and end share it", () => {
		expect(formatTimeRange("17:00", "h12")).toBe("5:00-5:30 PM");
		expect(formatTimeRange("09:00", "h12")).toBe("9:00-9:30 AM");
	});

	it("keeps both meridiems when the range crosses AM/PM", () => {
		expect(formatTimeRange("11:30", "h12")).toBe("11:30 AM-12:00 PM");
		expect(formatTimeRange("23:30", "h12")).toBe("11:30 PM-12:00 AM");
	});
});

describe("formatSlotRange", () => {
	it("formats a date slot as a time-only range", () => {
		expect(formatSlotRange("2026-10-05T17:00", "h23")).toBe("17:00-17:30");
		expect(formatSlotRange("2026-10-05T17:00", "h12")).toBe("5:00-5:30 PM");
	});
});

describe("formatWeeklySlotRange", () => {
	it("respects the hour cycle", () => {
		expect(formatWeeklySlotRange("MON-13:00", "h23")).toBe("Mon, 13:00-13:30");
		expect(formatWeeklySlotRange("MON-13:00", "h12")).toBe("Mon, 1:00-1:30 PM");
	});
});

describe("formatSlotWithDateRange", () => {
	it("respects the hour cycle", () => {
		expect(formatSlotWithDateRange("2026-01-01T13:00", "h23")).toBe(
			"1/1, 13:00-13:30",
		);
		expect(formatSlotWithDateRange("2026-01-01T13:00", "h12")).toBe(
			"1/1, 1:00-1:30 PM",
		);
	});

	it("orders day and month by locale", () => {
		expect(formatSlotWithDateRange("2026-09-28T13:00", "h23", "en-GB")).toBe(
			"28/09, 13:00-13:30",
		);
	});

	it("keeps Gregorian dates and Latin digits in every locale", () => {
		expect(formatSlotWithDateRange("2026-09-28T13:00", "h23", "fa-IR")).toBe(
			"9/28, 13:00-13:30",
		);
		expect(formatSlotWithDateRange("2026-09-28T13:00", "h23", "ar-EG")).toMatch(
			/^28‏?\/9, 13:00-13:30$/,
		);
	});

	it("returns malformed date slots unchanged", () => {
		expect(formatSlotWithDateRange("2026-9-28T13:00", "h23")).toBe(
			"2026-9-28T13:00",
		);
	});
});

describe("formatViewerSlotRange", () => {
	it("formats weekly slots without timezone conversion", () => {
		expect(formatViewerSlotRange("MON-13:00", "UTC", "UTC", "h23")).toBe(
			"Mon, 13:00-13:30",
		);
	});

	it("converts date slots to the viewer timezone", () => {
		expect(
			formatViewerSlotRange(
				"2026-10-05T09:00",
				"America/New_York",
				"Australia/Sydney",
				"h23",
			),
		).toBe("10/6, 00:00-00:30");
		expect(
			formatViewerSlotRange(
				"2026-10-05T09:00",
				"America/New_York",
				"Australia/Sydney",
				"h23",
				"en-GB",
			),
		).toBe("06/10, 00:00-00:30");
	});
});

describe("allTimezones", () => {
	it("lists IANA zones", () => {
		const zones = allTimezones();
		expect(zones.length).toBeGreaterThan(100);
		expect(zones).toContain("Europe/London");
		for (const z of zones) expect(typeof z).toBe("string");
	});
});

describe("buildSlotUniverse", () => {
	it("expands dates and hours into 30-min slots", () => {
		const slots = buildSlotUniverse({
			dates: ["2026-10-05"],
			endTime: "10:00",
			startTime: "09:00",
		});
		expect(slots).toEqual(["2026-10-05T09:00", "2026-10-05T09:30"]);
	});

	it("handles multiple dates sorted", () => {
		const slots = buildSlotUniverse({
			dates: ["2026-10-06", "2026-10-05"],
			endTime: "09:00",
			startTime: "08:00",
		});
		expect(slots[0]).toBe("2026-10-05T08:00");
		expect(slots).toHaveLength(4);
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
		).toEqual(["2026-10-05T09:00", "2026-10-05T09:30"]);
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
		).toEqual(["MON-09:00", "MON-09:30"]);
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
			["2026-10-05T09:00", "2026-10-05T09:30"],
			[
				{ name: "Alice", slots: ["2026-10-05T09:00"] },
				{ name: "Bob", slots: ["2026-10-05T09:00", "2026-10-05T09:30"] },
			],
		);
		expect(result).toEqual([
			{ count: 2, names: ["Alice", "Bob"], slot: "2026-10-05T09:00" },
			{ count: 1, names: ["Bob"], slot: "2026-10-05T09:30" },
		]);
	});
});

describe("findBestTimes", () => {
	it("sorts by count desc then earliest", () => {
		const best = findBestTimes(
			[
				{ count: 1, names: ["A"], slot: "2026-10-05T09:30" },
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
