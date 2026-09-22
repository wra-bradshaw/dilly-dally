import { describe, expect, it } from "vitest";
import { fetchEvent, listParticipants } from "./db";
import { DEMO_EVENT_IDS, seedDemo } from "./seed";
import { createTestDb } from "./test-db";

describe("seedDemo", () => {
	it("seeds demo events with consistent name keys", async () => {
		const { db } = await createTestDb();
		const first = await seedDemo(db, 1_750_000_000_000);
		expect(first.eventIds).toEqual(DEMO_EVENT_IDS);
		expect(first.participantCount).toBeGreaterThanOrEqual(14);
		for (const id of DEMO_EVENT_IDS) {
			expect(await fetchEvent(db, id)).not.toBeNull();
		}
		const parts = await listParticipants(db, DEMO_EVENT_IDS[0]);
		const keys = parts.map((p) => p.name.toLowerCase());
		expect(new Set(keys).size).toBe(parts.length);
	}, 30000);

	it("is idempotent", async () => {
		const { db } = await createTestDb();
		const first = await seedDemo(db, 1_750_000_000_000);
		const second = await seedDemo(db, 1_750_000_000_000);
		expect(second.participantCount).toBe(first.participantCount);
	}, 30000);
});
