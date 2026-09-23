import { describe, expect, it } from "vitest";
import {
	convertSlotZone,
	instantToSlot,
	slotToInstant,
	todayPlusInTimezone,
} from "./time-slots";

describe("slotToInstant", () => {
	it("converts New York wall time to UTC", () => {
		expect(slotToInstant("2026-10-05T09:00", "America/New_York")).toBe(
			Date.UTC(2026, 9, 5, 13, 0),
		);
	});

	it("handles half-hour zones", () => {
		expect(slotToInstant("2026-10-05T09:00", "Australia/Adelaide")).toBe(
			Date.UTC(2026, 9, 4, 22, 30),
		);
	});
});

describe("instantToSlot", () => {
	it("formats an instant in a zone", () => {
		expect(instantToSlot(Date.UTC(2026, 9, 5, 13, 0), "America/New_York")).toBe(
			"2026-10-05T09:00",
		);
		expect(
			instantToSlot(Date.UTC(2026, 9, 5, 13, 0), "America/Los_Angeles"),
		).toBe("2026-10-05T06:00");
	});

	it("round-trips across zones", () => {
		const ms = slotToInstant("2026-10-05T09:15", "America/New_York");
		expect(instantToSlot(ms, "Asia/Tokyo")).toBe("2026-10-05T22:15");
	});
});

describe("convertSlotZone", () => {
	it("maps a slot into the viewer zone", () => {
		expect(
			convertSlotZone(
				"2026-10-05T09:00",
				"America/New_York",
				"America/Los_Angeles",
			),
		).toBe("2026-10-05T06:00");
		expect(
			convertSlotZone(
				"2026-10-05T09:00",
				"America/New_York",
				"America/New_York",
			),
		).toBe("2026-10-05T09:00");
	});
});

describe("todayPlusInTimezone", () => {
	it("returns the wall date in zones ahead of UTC", () => {
		const now = Date.UTC(2026, 8, 23, 15, 0);
		expect(todayPlusInTimezone(0, "Australia/Melbourne", now)).toBe(
			"2026-09-24",
		);
		expect(todayPlusInTimezone(0, "UTC", now)).toBe("2026-09-23");
	});

	it("returns the wall date in zones behind UTC", () => {
		const now = Date.UTC(2026, 8, 24, 2, 0);
		expect(todayPlusInTimezone(0, "America/New_York", now)).toBe("2026-09-23");
	});

	it("adds days across month boundaries", () => {
		const now = Date.UTC(2026, 8, 30, 12, 0);
		expect(todayPlusInTimezone(0, "Australia/Melbourne", now)).toBe(
			"2026-09-30",
		);
		expect(todayPlusInTimezone(5, "Australia/Melbourne", now)).toBe(
			"2026-10-05",
		);
	});
});
