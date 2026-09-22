import { describe, expect, it } from "vitest";
import { buildMonthMatrix } from "./date-calendar";

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
