import { describe, expect, it } from "vitest";
import { createEventSchema, createPollSchema } from "./validation";

function futureDate(): string {
	const d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
	return d.toISOString().slice(0, 10);
}

describe("poll custom validation", () => {
	it("rejects duplicate options case-insensitive", () => {
		expect(
			createPollSchema.safeParse({
				options: ["Pizza", " pizza "],
				question: "Q?",
			}).success,
		).toBe(false);
	});

	it("rejects duplicate questions in one event", () => {
		expect(
			createEventSchema.safeParse({
				dates: [futureDate()],
				endTime: "10:00",
				polls: [
					{ options: ["A", "B"], question: "Q?" },
					{ options: ["C", "D"], question: " q? " },
				],
				startTime: "09:00",
				timezone: "UTC",
				title: "T",
			}).success,
		).toBe(false);
	});
});
