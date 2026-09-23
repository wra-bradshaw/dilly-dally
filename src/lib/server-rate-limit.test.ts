import { describe, expect, it } from "vitest";
import { checkRateLimitDb } from "./server-rate-limit";
import { createTestDb } from "./test-db";

describe("checkRateLimitDb", () => {
	it("allows first requests then blocks", async () => {
		const { db } = await createTestDb();
		for (let i = 0; i < 3; i++) {
			const r = await checkRateLimitDb(db, "k", i * 1000, 60_000, 3);
			expect(r.allowed).toBe(true);
		}
		const blocked = await checkRateLimitDb(db, "k", 4000, 60_000, 3);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
	});

	it("resets in new window", async () => {
		const { db } = await createTestDb();
		await checkRateLimitDb(db, "k", 1000, 60_000, 1);
		const next = await checkRateLimitDb(db, "k", 61_000, 60_000, 1);
		expect(next.allowed).toBe(true);
	});

	it("counts down remaining and holds at the limit when blocked", async () => {
		const { db } = await createTestDb();
		expect((await checkRateLimitDb(db, "k", 0, 60_000, 3)).remaining).toBe(2);
		expect((await checkRateLimitDb(db, "k", 1000, 60_000, 3)).remaining).toBe(
			1,
		);
		const last = await checkRateLimitDb(db, "k", 2000, 60_000, 3);
		expect(last).toMatchObject({ allowed: true, remaining: 0 });
		for (let i = 0; i < 3; i++) {
			const blocked = await checkRateLimitDb(db, "k", 3000 + i, 60_000, 3);
			expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
		}
		const fresh = await checkRateLimitDb(db, "k", 61_000, 60_000, 3);
		expect(fresh).toMatchObject({ allowed: true, remaining: 2 });
	});
});
