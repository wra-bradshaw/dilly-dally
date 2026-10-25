import { describe, expect, it } from "vitest";
import { eventFormSchema } from "#/lib/validation";

function baseForm() {
	return {
		dates: ["2026-10-05"],
		endTime: "17:00",
		mode: "dates" as const,
		polls: [],
		startTime: "09:00",
		timezone: "America/New_York",
		title: "Team offsite",
		weekdays: [1, 2, 3],
	};
}

describe("eventFormSchema", () => {
	it("accepts a valid dates-mode form", () => {
		expect(eventFormSchema.safeParse(baseForm()).success).toBe(true);
	});

	it("accepts a valid weekly-mode form with polls", () => {
		const parsed = eventFormSchema.safeParse({
			...baseForm(),
			dates: [],
			mode: "weekly",
			polls: [
				{
					options: ["Pizza", "Sushi"],
					question: "Where should we eat?",
				},
			],
			weekdays: [1, 2],
		});
		expect(parsed.success).toBe(true);
	});

	it("rejects an invalid timezone", () => {
		expect(
			eventFormSchema.safeParse({ ...baseForm(), timezone: "Mars/Olympus" })
				.success,
		).toBe(false);
		expect(
			eventFormSchema.safeParse({ ...baseForm(), timezone: "" }).success,
		).toBe(false);
	});

	it("rejects polls missing a question or with fewer than two options", () => {
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: [{ options: ["A", "B"], question: "   " }],
			}).success,
		).toBe(false);
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: [{ options: ["Only one"], question: "Pick?" }],
			}).success,
		).toBe(false);
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: [{ options: ["", "  "], question: "Pick?" }],
			}).success,
		).toBe(false);
	});

	it("rejects polls with text that is too long", () => {
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: [{ options: ["A", "B"], question: "x".repeat(141) }],
			}).success,
		).toBe(false);
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: [{ options: ["x".repeat(81), "B"], question: "Pick?" }],
			}).success,
		).toBe(false);
	});

	it("rejects duplicate poll options case-insensitively", () => {
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: [{ options: ["Pizza", "  pizza "], question: "Eat?" }],
			}).success,
		).toBe(false);
	});

	it("rejects duplicate poll questions case-insensitively", () => {
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: [
					{ options: ["A", "B"], question: "Where?" },
					{ options: ["C", "D"], question: "  WHERE? " },
				],
			}).success,
		).toBe(false);
	});

	it("rejects more than ten polls", () => {
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				polls: Array.from({ length: 11 }, (_, i) => ({
					options: ["A", "B"],
					question: `Q${i}?`,
				})),
			}).success,
		).toBe(false);
	});

	it("rejects equal and inverted times with minute math", () => {
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				endTime: "09:00",
				startTime: "09:00",
			}).success,
		).toBe(false);
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				endTime: "08:00",
				startTime: "22:00",
			}).success,
		).toBe(false);
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				endTime: "00:00",
				startTime: "23:30",
			}).success,
		).toBe(false);
	});

	it("accepts midnight boundaries only when the end is later", () => {
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				endTime: "00:30",
				startTime: "00:00",
			}).success,
		).toBe(true);
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				endTime: "00:00",
				startTime: "00:00",
			}).success,
		).toBe(false);
	});

	it("requires dates in dates mode and weekdays in weekly mode", () => {
		expect(
			eventFormSchema.safeParse({ ...baseForm(), dates: [] }).success,
		).toBe(false);
		expect(
			eventFormSchema.safeParse({
				...baseForm(),
				dates: [],
				mode: "weekly",
				weekdays: [],
			}).success,
		).toBe(false);
	});

	it("requires a non-blank title", () => {
		expect(
			eventFormSchema.safeParse({ ...baseForm(), title: "   " }).success,
		).toBe(false);
	});
});
