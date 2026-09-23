import { describe, expect, it } from "vitest";
import { decideRateLimit, rateLimitKey } from "./rate-limit";

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
});
