import { describe, expect, it } from "vitest";
import { weekdayFullName } from "./grid-model";

describe("weekdayFullName", () => {
	it("returns full English names Sunday through Saturday", () => {
		expect([
			weekdayFullName(0),
			weekdayFullName(1),
			weekdayFullName(2),
			weekdayFullName(3),
			weekdayFullName(4),
			weekdayFullName(5),
			weekdayFullName(6),
		]).toEqual([
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		]);
	});

	it("falls back for out-of-range weekdays", () => {
		expect(weekdayFullName(9)).toBe("Day 9");
	});
});
