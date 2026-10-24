import { describe, expect, it } from "vitest";
import { weekdayName } from "./grid-model";

describe("weekdayName", () => {
	it("returns short names by default and full names on request", () => {
		expect(weekdayName(1)).toBe("Mon");
		expect(weekdayName(1, "long")).toBe("Monday");
	});

	it("falls back for out-of-range weekdays", () => {
		expect(weekdayName(9)).toBe("Day 9");
	});
});
