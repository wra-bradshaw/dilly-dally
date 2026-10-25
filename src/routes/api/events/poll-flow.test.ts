import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "#/lib/test-db";
import { allowRateLimit, stubRateLimiters } from "./-rate-limit-test-stub";
import { createPollHandler } from "./$eventId/polls";
import { addPollOptionHandler } from "./$eventId/polls.$pollId.options";
import { deletePollOptionHandler } from "./$eventId/polls.$pollId.options.$optionId";
import { votePollHandler } from "./$eventId/polls.$pollId.vote";
import { handleCreate } from "./index";

vi.mock("#/lib/db-env", () => ({
	getDb: () => (globalThis as unknown as Record<string, unknown>).__testDb,
}));

function futureDate(offsetDays: number): string {
	const now = new Date();
	const d = new Date(
		Date.UTC(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			now.getUTCDate() + offsetDays,
		),
	);
	return d.toISOString().slice(0, 10);
}

function jsonPost(url: string, body: unknown) {
	return new Request(url, {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
		method: "POST",
	});
}

function jsonPut(url: string, body: unknown) {
	return new Request(url, {
		body: JSON.stringify(body),
		headers: { "content-type": "application/json" },
		method: "PUT",
	});
}

beforeAll(async () => {
	const { db } = await createTestDb();
	(globalThis as unknown as Record<string, unknown>).__testDb = db;
	stubRateLimiters(allowRateLimit());
});

afterEach(() => {
	stubRateLimiters(allowRateLimit());
});

describe("poll flow", () => {
	it("creates event with polls, votes, adds and removes options", async () => {
		const created = await handleCreate(
			jsonPost("https://x.test/api/events", {
				dates: [futureDate(5)],
				endTime: "10:00",
				polls: [{ options: ["Pizza", "Sushi"], question: "Eat?" }],
				startTime: "09:00",
				timezone: "UTC",
				title: "Team",
			}),
		);
		expect(created.status).toBe(201);
		const body = (await created.json()) as { id: string };
		const eventId = body.id;
		const added = await createPollHandler(
			jsonPost(`https://x.test/api/events/${eventId}/polls`, {
				options: ["A", "B", "C"],
				question: "Pick?",
			}),
			eventId,
		);
		expect(added.status).toBe(201);
		const addedBody = (await added.json()) as {
			poll: { id: string; options: Array<{ id: string }> };
		};
		const pollId = addedBody.poll.id;
		const optA = addedBody.poll.options[0]?.id ?? "";
		const voted = await votePollHandler(
			jsonPut(`https://x.test/api/events/${eventId}/polls/${pollId}/vote`, {
				name: "Ada",
				optionIds: [optA],
			}),
			eventId,
			pollId,
		);
		expect(voted.status).toBe(200);
		const blocked = await deletePollOptionHandler(
			new Request("https://x.test/api/y", { method: "DELETE" }),
			eventId,
			pollId,
			optA,
		);
		expect(blocked.status).toBe(409);
		const optB = addedBody.poll.options[1]?.id ?? "";
		const removed = await deletePollOptionHandler(
			new Request("https://x.test/api/y", { method: "DELETE" }),
			eventId,
			pollId,
			optB,
		);
		expect(removed.status).toBe(200);
		const addedOpt = await addPollOptionHandler(
			jsonPost(`https://x.test/api/events/${eventId}/polls/${pollId}/options`, {
				label: "D",
			}),
			eventId,
			pollId,
		);
		expect(addedOpt.status).toBe(201);
	});
});
