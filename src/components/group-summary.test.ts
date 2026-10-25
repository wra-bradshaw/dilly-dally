import { describe, expect, it } from "vitest";
import { formatGroupSummary } from "./grid-model";

describe("formatGroupSummary", () => {
	it("handles single group and skipped pluralization", () => {
		expect(formatGroupSummary(1, "day", "days", 1, 0)).toBe(
			"Showing 1 day in 1 group.",
		);
		expect(formatGroupSummary(3, "weekday", "weekdays", 2, 1)).toBe(
			"Showing 3 weekdays in 2 groups, 1 day skipped.",
		);
	});
});
