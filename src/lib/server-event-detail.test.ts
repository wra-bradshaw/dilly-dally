import { describe, expect, it } from "vitest";
import { fetchEvent, insertEvent } from "./db";
import { HttpError } from "./http-error";
import { upsertAvailability } from "./server-availability";
import { getEventDetail, loadEventDetailFromDb } from "./server-event-detail";
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

describe("loadEventDetailFromDb", () => {
	it("returns detail for an existing event", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, event);
		await upsertAvailability(
			db,
			event,
			{ name: "Alice", slots: ["2026-10-05T09:00"] },
			1000,
		);
		const detail = await loadEventDetailFromDb(db, event.id, 1_000_000);
		expect(detail.event.title).toBe("Standup");
		expect(detail.slotUniverse).toHaveLength(4);
		expect(detail.participants).toHaveLength(1);
	});

	it("throws not_found for a malformed id", async () => {
		const { db } = await createTestDb();
		await expect(
			loadEventDetailFromDb(db, "nope", 1_000_000),
		).rejects.toMatchObject({ code: "not_found", status: 404 });
	});

	it("throws not_found for an unknown id", async () => {
		const { db } = await createTestDb();
		await expect(
			loadEventDetailFromDb(db, "QwErTyUiOp12", 1_000_000),
		).rejects.toMatchObject({ code: "not_found", status: 404 });
	});

	it("throws gone and deletes an expired event", async () => {
		const { db } = await createTestDb();
		await insertEvent(db, { ...event, expiresAt: 500 });
		const promise = loadEventDetailFromDb(db, event.id, 1_000_000);
		await expect(promise).rejects.toBeInstanceOf(HttpError);
		await expect(promise).rejects.toMatchObject({ code: "gone", status: 410 });
		expect(await fetchEvent(db, event.id)).toBeNull();
	});
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
