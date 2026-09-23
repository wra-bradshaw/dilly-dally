import { describe, expect, it } from "vitest";
import { buildMonthMatrix, filterCalendarCommit } from "./date-calendar";

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
