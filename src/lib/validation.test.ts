import { describe, expect, it } from "vitest";
import {
	availabilitySchema,
	createEventSchema,
	nameKey,
	participantNameSchema,
} from "./validation";

describe("createEventSchema", () => {
	it("accepts a valid event", () => {
		const parsed = createEventSchema.safeParse({
			dates: ["2026-10-05", "2026-10-06"],
			endTime: "17:00",
			startTime: "09:00",
			timezone: "America/New_York",
			title: "Team offsite",
		});
		expect(parsed.success).toBe(true);
	});

	it("rejects empty title and bad times", () => {
		expect(
			createEventSchema.safeParse({
				dates: ["2026-10-05"],
				endTime: "09:00",
				startTime: "17:00",
				timezone: "America/New_York",
				title: "   ",
			}).success,
		).toBe(false);
	});

	it("rejects too many dates and invalid timezone", () => {
		expect(
			createEventSchema.safeParse({
				dates: Array.from(
					{ length: 32 },
					(_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`,
				),
				endTime: "17:00",
				startTime: "09:00",
				timezone: "Mars/Olympus",
				title: "x",
			}).success,
		).toBe(false);
	});

	it("rejects overnight range", () => {
		expect(
			createEventSchema.safeParse({
				dates: ["2026-10-05"],
				endTime: "08:00",
				startTime: "22:00",
				timezone: "UTC",
				title: "Night",
			}).success,
		).toBe(false);
	});
});

describe("availabilitySchema", () => {
	it("accepts valid availability", () => {
		expect(
			availabilitySchema.safeParse({
				name: "Alice",
				password: "secret-1234",
				slots: ["2026-10-05T09:00"],
			}).success,
		).toBe(true);
	});

	it("rejects bad slot ids", () => {
		expect(
			availabilitySchema.safeParse({ name: "Bob", slots: ["nope"] }).success,
		).toBe(false);
	});
});

describe("participantNameSchema and nameKey", () => {
	it("trims and lowercases for uniqueness", () => {
		expect(nameKey("  Alice ")).toBe("alice");
		expect(participantNameSchema.safeParse("  ").success).toBe(false);
		expect(participantNameSchema.safeParse("A".repeat(41)).success).toBe(false);
	});
});
