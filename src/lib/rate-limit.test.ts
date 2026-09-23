import { describe, expect, it } from "vitest";
import {
	decideRateLimit,
	type RateLimitState,
	rateLimitKey,
} from "./rate-limit";

describe("rateLimitKey", () => {
	it("hashes ip and scope without leaking ip", async () => {
		const key = await rateLimitKey("1.2.3.4", "create_event");
		expect(key).toContain("create_event:");
		expect(key).not.toContain("1.2.3.4");
	});
});

describe("windowStartFor", () => {
	it("computes window start", async () => {
		const { windowStartFor } = await import("./rate-limit");
		expect(windowStartFor(61_000, 60_000)).toBe(60_000);
		expect(windowStartFor(59_999, 60_000)).toBe(0);
	});
});

describe("decideRateLimit edges", () => {
	it("resets counts on stale windows", () => {
		const { next, result } = decideRateLimit(
			{ count: 99, windowStart: 0 },
			61_000,
			60_000,
			10,
		);
		expect(next).toEqual({ count: 1, windowStart: 60_000 });
		expect(result.allowed).toBe(true);
		expect(result.remaining).toBe(9);
	});

	it("denies everything with a zero limit", () => {
		const { result } = decideRateLimit(null, 1000, 60_000, 0);
		expect(result.allowed).toBe(false);
		expect(result.remaining).toBe(0);
	});

	it("allows first requests then blocks", () => {
		let stored: RateLimitState | null = null;
		for (let i = 0; i < 3; i++) {
			const { next, result } = decideRateLimit(stored, i * 1000, 60_000, 3);
			expect(result.allowed).toBe(true);
			stored = next;
		}
		const blocked = decideRateLimit(stored, 4000, 60_000, 3);
		expect(blocked.result.allowed).toBe(false);
		expect(blocked.result.remaining).toBe(0);
	});

	it("resets in new window", () => {
		const first = decideRateLimit(null, 1000, 60_000, 1);
		expect(first.result).toMatchObject({
			allowed: true,
			remaining: 0,
			resetMs: 60_000,
		});
		const next = decideRateLimit(first.next, 61_000, 60_000, 1);
		expect(next.result).toMatchObject({
			allowed: true,
			remaining: 0,
			resetMs: 120_000,
		});
	});

	it("counts down remaining and holds at the limit when blocked", () => {
		let stored: RateLimitState | null = null;
		const seen: number[] = [];
		for (let i = 0; i < 6; i++) {
			const { next, result } = decideRateLimit(stored, i * 1000, 60_000, 3);
			seen.push(result.remaining);
			stored = next;
		}
		expect(seen).toEqual([2, 1, 0, 0, 0, 0]);
		const fresh = decideRateLimit(stored, 61_000, 60_000, 3);
		expect(fresh.result).toMatchObject({ allowed: true, remaining: 2 });
	});
});
