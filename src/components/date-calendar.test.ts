import { describe, expect, it } from "vitest";
import {
	autoscrollVelocity,
	buildMonthMatrix,
	filterCalendarCommit,
	monthsInRange,
	trimDisabledWeeks,
} from "./date-calendar";

describe("buildMonthMatrix", () => {
	it("starts September 2026 on Tuesday", () => {
		const weeks = buildMonthMatrix(2026, 8);
		expect(weeks[0]).toEqual([
			null,
			null,
			"2026-09-01",
			"2026-09-02",
			"2026-09-03",
			"2026-09-04",
			"2026-09-05",
		]);
		expect(weeks.flat().filter(Boolean)).toHaveLength(30);
	});

	it("pads trailing cells to full weeks", () => {
		for (const weeks of [
			buildMonthMatrix(2026, 0),
			buildMonthMatrix(2026, 1),
		]) {
			for (const w of weeks) expect(w).toHaveLength(7);
		}
	});
});

describe("monthsInRange", () => {
	it("lists every month from the min date through the max date", () => {
		expect(monthsInRange("2026-09-22", "2026-12-21")).toEqual([
			{ m: 8, y: 2026 },
			{ m: 9, y: 2026 },
			{ m: 10, y: 2026 },
			{ m: 11, y: 2026 },
		]);
	});

	it("returns a single month when min and max share it", () => {
		expect(monthsInRange("2026-09-28", "2026-09-28")).toEqual([
			{ m: 8, y: 2026 },
		]);
	});

	it("rolls over year boundaries", () => {
		expect(monthsInRange("2026-12-15", "2027-01-10")).toEqual([
			{ m: 11, y: 2026 },
			{ m: 0, y: 2027 },
		]);
	});

	it("caps runaway ranges instead of rendering forever", () => {
		expect(monthsInRange("2026-01-01", "2030-01-01")).toHaveLength(24);
	});

	it("falls back to the min month when the range is unusable", () => {
		expect(monthsInRange("2026-09-22", "not-a-date")).toEqual([
			{ m: 8, y: 2026 },
		]);
		expect(monthsInRange("2026-10-05", "2026-09-01")).toEqual([
			{ m: 9, y: 2026 },
		]);
	});
});

describe("trimDisabledWeeks", () => {
	it("drops leading weeks with no enabled days", () => {
		const weeks = buildMonthMatrix(2026, 8);
		const trimmed = trimDisabledWeeks(weeks, "2026-09-22", "2026-09-30");
		expect(trimmed.length).toBeLessThan(weeks.length);
		expect(trimmed.flat()).toContain("2026-09-22");
		expect(trimmed.flat()).not.toContain("2026-09-01");
	});

	it("keeps the boundary week that holds the first enabled day", () => {
		const trimmed = trimDisabledWeeks(
			buildMonthMatrix(2026, 8),
			"2026-09-22",
			"2026-09-30",
		);
		expect(trimmed[0]).toContain("2026-09-22");
	});

	it("returns every week when the whole month is enabled", () => {
		const weeks = buildMonthMatrix(2026, 8);
		expect(trimDisabledWeeks(weeks, "2026-09-01", "2026-09-30")).toEqual(weeks);
	});

	it("returns no weeks when nothing is enabled", () => {
		expect(
			trimDisabledWeeks(buildMonthMatrix(2026, 8), "2026-10-01", "2026-10-31"),
		).toEqual([]);
	});
});

describe("filterCalendarCommit", () => {
	it("preserves off-month selection through commit", () => {
		const visible = buildMonthMatrix(2026, 8).flat();
		const selected = new Set(["2026-10-05", "2026-09-10"]);
		const next = new Set(["2026-09-11"]);
		const kept = filterCalendarCommit(
			next,
			selected,
			visible,
			"2026-09-01",
			"2026-10-31",
		);
		expect(kept.has("2026-09-11")).toBe(true);
		expect(kept.has("2026-10-05")).toBe(true);
		expect(kept.has("2026-09-10")).toBe(false);
	});

	it("drops out-of-range days", () => {
		const visible = buildMonthMatrix(2026, 8).flat();
		const kept = filterCalendarCommit(
			new Set(["2026-08-31", "2026-09-02"]),
			new Set(["2026-11-01"]),
			visible,
			"2026-09-01",
			"2026-09-30",
		);
		expect(kept).toEqual(new Set(["2026-09-02"]));
	});
});

describe("autoscrollVelocity", () => {
	it("stays still outside the edge zone", () => {
		expect(autoscrollVelocity(0)).toBe(0);
		expect(autoscrollVelocity(-4)).toBe(0);
	});

	it("starts slow at the zone edge", () => {
		expect(autoscrollVelocity(1)).toBeCloseTo(1.1, 5);
		expect(autoscrollVelocity(5)).toBeCloseTo(1.5, 5);
	});

	it("scales speed with penetration depth", () => {
		expect(autoscrollVelocity(36)).toBeCloseTo(4.6, 5);
		expect(autoscrollVelocity(30)).toBeGreaterThan(autoscrollVelocity(5));
		expect(autoscrollVelocity(36)).toBeGreaterThan(autoscrollVelocity(10));
	});

	it("caps speed for deep penetration", () => {
		expect(autoscrollVelocity(40)).toBe(5);
		expect(autoscrollVelocity(100)).toBe(5);
		expect(autoscrollVelocity(1000)).toBe(5);
	});
});
