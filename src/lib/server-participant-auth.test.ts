import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getParticipantRow, insertEvent } from "./db";
import * as schema from "./schema";
import { upsertAvailability } from "./server-availability";
import { createPollInDb, votePollInDb } from "./server-polls";
import { createTestDb } from "./test-db";

const event = {
	createdAt: 1_700_000_000_000,
	dates: ["2026-10-05"],
	endTime: "10:00",
	expiresAt: 1_800_000_000_000,
	id: "AbC123_-XyZ9",
	mode: "dates" as const,
	startTime: "09:00",
	timezone: "UTC",
	title: "Standup",
	weekdays: [] as number[],
};

function countingDeps(verifyResult = true) {
	let hashes = 0;
	let verifies = 0;
	return {
		counts: () => ({ hashes, verifies }),
		deps: {
			hash: async (pw: string) => {
				hashes += 1;
				return `HASH:${pw}`;
			},
			verify: async (_pw: string, _stored: string) => {
				verifies += 1;
				return verifyResult;
			},
		},
	};
}

async function setupPoll() {
	const { db } = await createTestDb();
	await insertEvent(db, event);
	const created = await createPollInDb(
		db,
		event.id,
		{ options: ["A", "B"], question: "Q?" },
		1000,
	);
	if (!created.ok) throw new Error("poll setup failed");
	return {
		db,
		pollId: created.poll.id,
		optA: created.poll.options[0]?.id ?? "",
	};
}

describe("participant/password race hash budgets", () => {
	it("availability win hashes exactly once and never verifies", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const c = countingDeps();
		const res = await upsertAvailability(
			db,
			event,
			{ name: "Neo", password: "pw-neo-12345", slots: ["2026-10-05T09:00"] },
			1000,
			c.deps,
		);
		expect(res.ok).toBe(true);
		expect(c.counts()).toEqual({ hashes: 1, verifies: 0 });
	});

	it("availability session-authenticated create skips hashing entirely", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const c = countingDeps();
		const res = await upsertAvailability(
			db,
			event,
			{ name: "Neo", password: "pw-neo-12345", slots: ["2026-10-05T09:00"] },
			1000,
			c.deps,
			{ sessionNameKey: "neo" },
		);
		expect(res.ok).toBe(true);
		expect(c.counts()).toEqual({ hashes: 0, verifies: 0 });
	});

	it("poll win hashes exactly once and never verifies", async () => {
		const { db, pollId, optA } = await setupPoll();
		const c = countingDeps();
		const res = await votePollInDb(
			db,
			event,
			pollId,
			{ name: "Neo", optionIds: [optA], password: "pw-neo-12345" },
			1000,
			c.deps,
		);
		expect(res.ok).toBe(true);
		expect(c.counts()).toEqual({ hashes: 1, verifies: 0 });
	});

	it("poll session-authenticated create skips hashing entirely", async () => {
		const { db, pollId, optA } = await setupPoll();
		const c = countingDeps();
		const res = await votePollInDb(
			db,
			event,
			pollId,
			{ name: "Neo", optionIds: [optA], password: "pw-neo-12345" },
			1000,
			c.deps,
			{ sessionNameKey: "neo" },
		);
		expect(res.ok).toBe(true);
		expect(c.counts()).toEqual({ hashes: 0, verifies: 0 });
	});

	it("availability reuses the pre-insert hash instead of hashing twice on loss", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		let hashes = 0;
		const res = await upsertAvailability(
			db,
			event,
			{
				name: "Racer",
				password: "loser-secret-1",
				slots: ["2026-10-05T09:00"],
			},
			1000,
			{
				hash: async (pw: string) => {
					hashes += 1;
					await db
						.insert(schema.participants)
						.values({
							eventId: event.id,
							nameDisplay: "Racer",
							nameKey: "racer",
							passwordHash: null,
							slotsJson: JSON.stringify(["2026-10-05T09:30"]),
							updatedAt: 999,
						})
						.onConflictDoNothing({
							target: [
								schema.participants.eventId,
								schema.participants.nameKey,
							],
						});
					return `HASH:${pw}`;
				},
				verify: async () => true,
			},
		);
		expect(res.ok).toBe(true);
		expect(hashes).toBe(1);
	});

	it("poll claim fails closed when a rival password lands mid-hash", async () => {
		const { db, pollId, optA } = await setupPoll();
		await upsertAvailability(db, event, { name: "Cara", slots: [] }, 1000, {
			hash: async () => "SEED",
			verify: async () => true,
		});
		const res = await votePollInDb(
			db,
			event,
			pollId,
			{ name: "cara", optionIds: [optA], password: "claim-secret-1" },
			1001,
			{
				hash: async () => {
					await db
						.update(schema.participants)
						.set({ passwordHash: "RIVAL" })
						.where(
							and(
								eq(schema.participants.eventId, event.id),
								eq(schema.participants.nameKey, "cara"),
							),
						);
					return "NEW";
				},
				verify: async () => true,
			},
		);
		expect(res).toEqual({ code: "invalid_password", ok: false });
		const stored = await getParticipantRow(db, event.id, "cara");
		expect(stored?.passwordHash).toBe("RIVAL");
	});

	it("concurrent creates with different passwords leave exactly one winner", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const [first, second] = await Promise.all([
			upsertAvailability(
				db,
				event,
				{
					name: "Duel",
					password: "winner-secret-1",
					slots: ["2026-10-05T09:00"],
				},
				1000,
				{
					hash: async (pw: string) => `HASH:${pw}`,
					verify: async (pw: string, stored: string) => stored === `HASH:${pw}`,
				},
			),
			upsertAvailability(
				db,
				event,
				{
					name: "duel",
					password: "loser-secret-2",
					slots: ["2026-10-05T09:30"],
				},
				1001,
				{
					hash: async (pw: string) => `HASH:${pw}`,
					verify: async (pw: string, stored: string) => stored === `HASH:${pw}`,
				},
			),
		]);
		const oks = [first.ok, second.ok].filter(Boolean).length;
		expect(oks).toBe(1);
		const stored = await getParticipantRow(db, event.id, "duel");
		expect(stored?.passwordHash).toMatch(/^HASH:/);
	});
});
