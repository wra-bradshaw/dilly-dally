import { describe, expect, it } from "vitest";
import {
	allTimezones,
	browserTimezone,
	buildEventUniverse,
	buildSlotUniverse,
	computeCounts,
	findBestTimes,
	formatSlotLabel,
	formatSlotWithDate,
	formatWeeklySlot,
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
		expect(formatSlotWithDate("2026-01-01T13:00", "h23")).toBe("Jan 1, 13:00");
		expect(formatSlotWithDate("2026-01-01T13:00", "h12")).toBe(
			"Jan 1, 1:00 PM",
		);
	});
});

describe("formatWeeklySlot", () => {
	it("respects the hour cycle", () => {
		expect(formatWeeklySlot("MON-13:00", "h23")).toBe("Mon, 13:00");
		expect(formatWeeklySlot("MON-13:00", "h12")).toBe("Mon, 1:00 PM");
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

describe("formatSlotWithDate", () => {
	it("includes month, day, and time in the pinned locale", () => {
		const monthDay = (date: string) => {
			const [y, m, d] = date.split("-").map(Number);
			return new Intl.DateTimeFormat("en-US", {
				day: "numeric",
				month: "short",
				timeZone: "UTC",
			}).format(new Date(Date.UTC(y, m - 1, d)));
		};
		const time = (t: string) => {
			const [hh, mm] = t.split(":").map(Number);
			return new Intl.DateTimeFormat("en-US", {
				hour: "numeric",
				minute: "2-digit",
				timeZone: "UTC",
			}).format(new Date(Date.UTC(2000, 0, 1, hh, mm)));
		};
		expect(formatSlotWithDate("2026-10-06T00:00")).toBe(
			`${monthDay("2026-10-06")}, ${time("00:00")}`,
		);
		expect(formatSlotWithDate("2026-09-28T09:30")).toBe(
			`${monthDay("2026-09-28")}, ${time("09:30")}`,
		);
	});
});

describe("formatSlotLabel hour cycles", () => {
	it("omitting the cycle matches 12-hour output", () => {
		for (const slot of [
			"2026-01-01T00:00",
			"2026-01-01T12:00",
			"2026-01-01T13:30",
		]) {
			expect(formatSlotLabel(slot)).toBe(formatSlotLabel(slot, "h12"));
			expect(formatSlotWithDate(slot)).toBe(formatSlotWithDate(slot, "h12"));
		}
		expect(formatWeeklySlot("MON-13:30")).toBe(
			formatWeeklySlot("MON-13:30", "h12"),
		);
	});

	it("formats midnight and noon across cycles", () => {
		expect(formatSlotLabel("2026-01-01T00:00", "h11")).toBe("0:00 AM");
		expect(formatSlotLabel("2026-01-01T12:00", "h11")).toBe("0:00 PM");
		expect(formatSlotLabel("2026-01-01T00:00", "h24")).toBe("24:00");
		expect(formatSlotLabel("2026-01-01T12:00", "h24")).toBe("12:00");
		expect(formatSlotLabel("2026-01-01T13:30", "h24")).toBe("13:30");
		expect(formatSlotWithDate("2026-01-01T00:00", "h23")).toBe("Jan 1, 00:00");
		expect(formatWeeklySlot("MON-00:00", "h23")).toBe("Mon, 00:00");
	});
});
