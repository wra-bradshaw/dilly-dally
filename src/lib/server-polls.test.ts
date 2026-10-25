import { describe, expect, it } from "vitest";
import { insertEvent } from "./db";
import {
	addPollOptionInDb,
	createPollInDb,
	deletePollOptionInDb,
	listPollsDetail,
	votePollInDb,
} from "./server-polls";
import { createTestDb, withQueryCounter } from "./test-db";

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

async function setup() {
	const { db } = await createTestDb();
	await insertEvent(db, event);
	return { db };
}

describe("createPollInDb", () => {
	it("creates a poll with ordered options", async () => {
		const { db } = await setup();
		const res = await createPollInDb(
			db,
			event.id,
			{ options: ["Pizza", "Sushi"], question: "Where?" },
			1000,
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.poll.options.map((o) => o.label)).toEqual(["Pizza", "Sushi"]);
		expect(res.poll.allowMultiple).toBe(false);
	});

	it("rejects duplicate questions", async () => {
		const { db } = await setup();
		await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		const dup = await createPollInDb(
			db,
			event.id,
			{ options: ["C", "D"], question: " q? " },
			1001,
		);
		expect(dup).toEqual({ code: "duplicate_question", ok: false });
	});

	it("enforces max polls and max options", async () => {
		const { db } = await setup();
		for (let i = 0; i < 10; i++) {
			const res = await createPollInDb(
				db,
				event.id,
				{ options: ["A", "B"], question: `Q${i}?` },
				1000 + i,
			);
			expect(res.ok).toBe(true);
		}
		expect(
			await createPollInDb(
				db,
				event.id,
				{ options: ["A", "B"], question: "Extra?" },
				2000,
			),
		).toEqual({ code: "too_many_polls", ok: false });
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Other?" },
			3000,
		);
		// poll creation above should fail, use first poll for options cap
		const polls = await listPollsDetail(db, event.id);
		const firstId = polls[0]?.id ?? "";
		for (let i = 2; i < 10; i++) {
			await addPollOptionInDb(db, event.id, firstId, `O${i}`, 4000 + i);
		}
		expect(
			await addPollOptionInDb(db, event.id, firstId, "Overflow", 5000),
		).toEqual({ code: "too_many_options", ok: false });
		expect(created.ok).toBe(false);
	});

	it("rejects unknown option ids", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		expect(
			await votePollInDb(db, event, created.poll.id, {
				name: "Ada",
				optionIds: ["nope"],
			}),
		).toEqual({ code: "invalid_option", ok: false });
	});
});

describe("add and delete options", () => {
	it("adds unique option and blocks duplicates", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const added = await addPollOptionInDb(
			db,
			event.id,
			created.poll.id,
			"C",
			1001,
		);
		expect(added.ok).toBe(true);
		const dup = await addPollOptionInDb(
			db,
			event.id,
			created.poll.id,
			" a ",
			1002,
		);
		expect(dup).toEqual({ code: "duplicate_option", ok: false });
	});

	it("blocks deleting voted options but allows unvoted", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B", "C"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const pollId = created.poll.id;
		const optA = created.poll.options[0]?.id ?? "";
		const optB = created.poll.options[1]?.id ?? "";
		const voted = await votePollInDb(
			db,
			{ ...event, id: event.id },
			pollId,
			{ name: "Ada", optionIds: [optA] },
			1001,
		);
		expect(voted.ok).toBe(true);
		expect(await deletePollOptionInDb(db, event.id, pollId, optA)).toEqual({
			code: "has_votes",
			ok: false,
		});
		expect(await deletePollOptionInDb(db, event.id, pollId, optB)).toEqual({
			ok: true,
		});
	});

	it("blocks deleting down to fewer than two options", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const optA = created.poll.options[0]?.id ?? "";
		expect(
			await deletePollOptionInDb(db, event.id, created.poll.id, optA),
		).toEqual({ code: "too_few_options", ok: false });
	});
});

describe("votePollInDb", () => {
	it("saves single-choice votes and clears on empty", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const pollId = created.poll.id;
		const optA = created.poll.options[0]?.id ?? "";
		const optB = created.poll.options[1]?.id ?? "";
		const first = await votePollInDb(
			db,
			event,
			pollId,
			{ name: "Ada", optionIds: [optA] },
			1001,
		);
		expect(first.ok).toBe(true);
		const detail = await listPollsDetail(db, event.id);
		expect(detail[0]?.options[0]).toMatchObject({
			count: 1,
			names: ["Ada"],
		});
		const second = await votePollInDb(
			db,
			event,
			pollId,
			{ name: "Ada", optionIds: [optB] },
			1002,
		);
		expect(second.ok).toBe(true);
		const detail2 = await listPollsDetail(db, event.id);
		expect(detail2[0]?.options[0]?.count).toBe(0);
		expect(detail2[0]?.options[1]).toMatchObject({
			count: 1,
			names: ["Ada"],
		});
		const cleared = await votePollInDb(
			db,
			event,
			pollId,
			{ name: "Ada", optionIds: [] },
			1003,
		);
		expect(cleared.ok).toBe(true);
		expect((await listPollsDetail(db, event.id))[0]?.totalVoters).toBe(0);
	});

	it("reports not_found before validating options", async () => {
		const { db } = await setup();
		expect(
			await votePollInDb(db, event, "missingpoll1", {
				name: "Ada",
				optionIds: ["nope", "nah"],
			}),
		).toEqual({ code: "not_found", ok: false });
	});

	it("rejects multi-select on single-choice polls", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const ids = created.poll.options.map((o) => o.id);
		expect(
			await votePollInDb(db, event, created.poll.id, {
				name: "Ada",
				optionIds: ids,
			}),
		).toEqual({ code: "invalid_selection", ok: false });
	});

	it("allows multi-select when enabled and enforces passwords", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ allowMultiple: true, options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const ids = created.poll.options.map((o) => o.id);
		const ok = await votePollInDb(
			db,
			event,
			created.poll.id,
			{ name: "Bob", optionIds: ids, password: "secret-1234" },
			1001,
		);
		expect(ok.ok).toBe(true);
		expect(
			await votePollInDb(db, event, created.poll.id, {
				name: "bob",
				optionIds: [],
				password: "wrong-pass-1",
			}),
		).toEqual({ code: "invalid_password", ok: false });
	});
});

describe("poll read concurrency", () => {
	it("fetches poll detail queries concurrently", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const optA = created.poll.options[0]?.id ?? "";
		const voted = await votePollInDb(
			db,
			event,
			created.poll.id,
			{ name: "Ada", optionIds: [optA] },
			1001,
		);
		expect(voted.ok).toBe(true);
		const counted = withQueryCounter(db);
		const detail = await listPollsDetail(counted.db, event.id);
		expect(detail).toHaveLength(1);
		expect(detail[0]?.options[0]).toMatchObject({ count: 1 });
		expect(counted.state.maxInFlight).toBe(3);
	});

	it("fetches vote validation reads concurrently", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const counted = withQueryCounter(db);
		const res = await votePollInDb(
			counted.db,
			event,
			created.poll.id,
			{ name: "Ada", optionIds: [] },
			1001,
		);
		expect(res.ok).toBe(true);
		expect(counted.state.maxInFlight).toBeGreaterThanOrEqual(3);
	});

	it("writes votes in one batch when supported", async () => {
		const { db } = await setup();
		const created = await createPollInDb(
			db,
			event.id,
			{ options: ["A", "B"], question: "Q?" },
			1000,
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		(db as unknown as { batch: unknown }).batch = async (items: unknown[]) => {
			const out: unknown[] = [];
			for (const item of items) out.push(await item);
			return out;
		};
		const counted = withQueryCounter(db);
		const res = await votePollInDb(
			counted.db,
			event,
			created.poll.id,
			{ name: "Ada", optionIds: [created.poll.options[0]?.id ?? ""] },
			1001,
		);
		expect(res.ok).toBe(true);
		expect(counted.state.batches).toBe(1);
		expect(counted.state.queries).toBe(5);
	});
});
