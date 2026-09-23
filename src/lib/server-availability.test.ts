import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fetchEvent, getParticipantRow, insertEvent } from "./db";
import {
	getEventDetail,
	getOwnAvailability,
	upsertAvailability,
} from "./server-availability";
import * as schema from "./schema";
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

describe("upsertAvailability", () => {
	it("creates unprotected availability", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const res = await upsertAvailability(
			db,
			event,
			{ name: "Alice", slots: ["2026-10-05T09:00"] },
			1000,
		);
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.result.protected).toBe(false);
			expect(res.result.count).toBe(1);
		}
	});

	it("rejects slots outside the universe", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const res = await upsertAvailability(
			db,
			event,
			{ name: "Alice", slots: ["2026-10-06T09:00"] },
			1000,
		);
		expect(res).toEqual({ code: "invalid_slot", ok: false });
	});

	it("enforces passwords", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const created = await upsertAvailability(
			db,
			event,
			{
				name: "Bob",
				password: "s3cret-pw12",
				slots: ["2026-10-05T09:00"],
			},
			1000,
		);
		expect(created.ok).toBe(true);
		const wrong = await upsertAvailability(
			db,
			event,
			{ name: "bob", password: "nope-nope-no", slots: [] },
			1001,
		);
		expect(wrong).toEqual({ code: "invalid_password", ok: false });
		const right = await upsertAvailability(
			db,
			event,
			{ name: "BOB", password: "s3cret-pw12", slots: [] },
			1002,
		);
		expect(right.ok).toBe(true);
		if (right.ok) expect(right.result.count).toBe(0);
	}, 20000);

	it("lets an unprotected name claim a password", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(db, event, { name: "Cara", slots: [] }, 1000);
		const claimed = await upsertAvailability(
			db,
			event,
			{ name: "cara", password: "claim-me-123", slots: [] },
			1001,
		);
		expect(claimed.ok).toBe(true);
		if (claimed.ok) expect(claimed.result.protected).toBe(true);
	}, 20000);

	it("survives concurrent creates for the same new name", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const [first, second] = await Promise.all([
			upsertAvailability(
				db,
				event,
				{ name: "Race", slots: ["2026-10-05T09:00"] },
				1000,
			),
			upsertAvailability(
				db,
				event,
				{ name: "race", slots: ["2026-10-05T09:15"] },
				1001,
			),
		]);
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		const stored = await getOwnAvailability(db, event, "race", null);
		expect(stored.ok).toBe(true);
		if (stored.ok) {
			expect(stored.slots).toHaveLength(1);
			expect(["2026-10-05T09:00", "2026-10-05T09:15"]).toContain(
				stored.slots[0],
			);
		}
	});

	it("requires the winning password when concurrent creates race with passwords", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		const [first] = await Promise.all([
			upsertAvailability(
				db,
				event,
				{
					name: "Racy",
					password: "winner-secret-1",
					slots: ["2026-10-05T09:00"],
				},
				1000,
			),
		]);
		expect(first.ok).toBe(true);
		const wrong = await upsertAvailability(
			db,
			event,
			{ name: "racy", password: "loser-secret-2", slots: [] },
			1001,
		);
		expect(wrong).toEqual({ code: "invalid_password", ok: false });
	}, 20000);

	it("fails closed when a password lands mid-claim instead of overwriting", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(db, event, { name: "Cara", slots: [] }, 1000);
		const res = await upsertAvailability(
			db,
			event,
			{ name: "cara", password: "claim", slots: ["2026-10-05T09:00"] },
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

	it("fails closed when a protected hash rotates mid-save", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Bob", password: "old-pw", slots: [] },
			1000,
			{ hash: async () => "OLD", verify: async () => true },
		);
		const res = await upsertAvailability(
			db,
			event,
			{ name: "bob", password: "old-pw", slots: ["2026-10-05T09:00"] },
			1001,
			{
				hash: async () => "OLD",
				verify: async () => {
					await db
						.update(schema.participants)
						.set({ passwordHash: "RIVAL" })
						.where(
							and(
								eq(schema.participants.eventId, event.id),
								eq(schema.participants.nameKey, "bob"),
							),
						);
					return true;
				},
			},
		);
		expect(res).toEqual({ code: "invalid_password", ok: false });
		const stored = await getParticipantRow(db, event.id, "bob");
		expect(stored?.passwordHash).toBe("RIVAL");
		expect(stored?.slotsJson).toBe(JSON.stringify([]));
	});
});

describe("getOwnAvailability", () => {
	it("returns slots and requires password when set", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Dan", password: "dan-secret-1", slots: ["2026-10-05T09:15"] },
			1000,
		);
		const authed = await getOwnAvailability(db, event, "dan", "dan-secret-1");
		expect(authed).toEqual({
			name: "Dan",
			ok: true,
			slots: ["2026-10-05T09:15"],
		});
		expect(await getOwnAvailability(db, event, "dan", null)).toEqual({
			code: "invalid_password",
			ok: false,
		});
		expect(await getOwnAvailability(db, event, "nobody", null)).toEqual({
			code: "not_found",
			ok: false,
		});
	}, 20000);
});

describe("getEventDetail", () => {
	it("computes counts and best times", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Alice", slots: ["2026-10-05T09:00"] },
			1000,
		);
		await upsertAvailability(
			db,
			event,
			{ name: "Bob", slots: ["2026-10-05T09:00", "2026-10-05T09:15"] },
			1001,
		);
		const stored = await fetchEvent(db, event.id);
		const detail = await getEventDetail(db, stored ?? event);
		expect(detail.slotUniverse).toHaveLength(4);
		expect(detail.counts[0]).toEqual({
			count: 2,
			names: ["Alice", "Bob"],
			slot: "2026-10-05T09:00",
		});
		expect(detail.bestTimes[0]).toEqual({
			count: 2,
			slot: "2026-10-05T09:00",
		});
		expect(detail.participants).toHaveLength(2);
	});
});
