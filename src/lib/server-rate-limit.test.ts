import { describe, expect, it } from "vitest";
import { RATE_LIMITS, rateLimitKey } from "./rate-limit";
import {
	bindingForScope,
	checkRateLimit,
	doRateLimit,
	guardRateLimit,
} from "./server-rate-limit";

function fakeBinding(success: boolean, seen?: { key?: string }) {
	return {
		limit: async (opts: { key: string }) => {
			if (seen) seen.key = opts.key;
			return { success };
		},
	} as unknown as RateLimit;
}

function request(ip: string) {
	return new Request("https://x.test/api/events", {
		headers: { "cf-connecting-ip": ip },
	});
}

describe("RATE_LIMITS", () => {
	it("uses native-compatible 60s windows", () => {
		for (const budget of Object.values(RATE_LIMITS)) {
			expect(budget.windowMs).toBe(60_000);
		}
	});
});

describe("rateLimitKey", () => {
	it("is stable and isolates scope and ip", async () => {
		const a = await rateLimitKey("1.1.1.1", "read");
		expect(await rateLimitKey("1.1.1.1", "read")).toBe(a);
		expect(await rateLimitKey("1.1.1.1", "availability_write")).not.toBe(a);
		expect(await rateLimitKey("2.2.2.2", "read")).not.toBe(a);
	});
});

describe("bindingForScope", () => {
	it("routes read, create_event, and write scopes", () => {
		const bindings = {
			AVAIL_WRITE_LIMITER: fakeBinding(true),
			CREATE_EVENT_LIMITER: fakeBinding(true),
			READ_LIMITER: fakeBinding(true),
		} as unknown as Record<string, RateLimit | undefined>;
		expect(bindingForScope("read", bindings)).toBe(bindings.READ_LIMITER);
		expect(bindingForScope("create_event", bindings)).toBe(
			bindings.CREATE_EVENT_LIMITER,
		);
		expect(bindingForScope("availability_write", bindings)).toBe(
			bindings.AVAIL_WRITE_LIMITER,
		);
	});
});

describe("checkRateLimit", () => {
	it("maps native success to allowed", async () => {
		const ok = await checkRateLimit("k", "read", 60_000, fakeBinding(true));
		expect(ok.allowed).toBe(true);
		expect(ok.remaining).toBe(1);
		const blocked = await checkRateLimit(
			"k",
			"read",
			60_000,
			fakeBinding(false),
		);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
	});

	it("passes the key through and synthesizes resetMs", async () => {
		const seen: { key?: string } = {};
		const before = Date.now();
		const res = await checkRateLimit(
			"scope:abc",
			"read",
			60_000,
			fakeBinding(true, seen),
		);
		expect(seen.key).toBe("scope:abc");
		expect(res.resetMs).toBeGreaterThanOrEqual(before);
		expect(res.resetMs).toBeLessThanOrEqual(before + 60_000);
	});
});

describe("doRateLimit", () => {
	it("keys by scope and client ip", async () => {
		const seenA: { key?: string } = {};
		const seenB: { key?: string } = {};
		await doRateLimit(
			request("4.4.4.4"),
			"read",
			{ limit: 120, windowMs: 60_000 },
			fakeBinding(true, seenA),
		);
		await doRateLimit(
			request("4.4.4.4"),
			"availability_write",
			{ limit: 30, windowMs: 60_000 },
			fakeBinding(true, seenB),
		);
		expect(seenA.key).not.toBe(seenB.key);
	});

	it("denies when the binding reports failure", async () => {
		const res = await doRateLimit(
			request("6.6.6.6"),
			"read",
			{ limit: 120, windowMs: 60_000 },
			fakeBinding(false),
		);
		expect(res.allowed).toBe(false);
	});
});

describe("guardRateLimit", () => {
	it("returns null while the budget allows", async () => {
		const res = await guardRateLimit(
			request("1.1.1.1"),
			"read",
			{ limit: 120, windowMs: 60_000 },
			undefined,
			fakeBinding(true),
		);
		expect(res).toBeNull();
	});

	it("maps denial to a 429 honoring noStore", async () => {
		const throttled = await guardRateLimit(
			request("2.2.2.2"),
			"read",
			{ limit: 120, windowMs: 60_000 },
			{ noStore: true },
			fakeBinding(false),
		);
		expect(throttled?.status).toBe(429);
		expect(throttled?.headers.get("Cache-Control")).toBe("no-store");
		expect(throttled?.headers.get("Retry-After")).toMatch(/^\d+$/);
		const plain = await guardRateLimit(
			request("2.2.2.2"),
			"read",
			{ limit: 120, windowMs: 60_000 },
			undefined,
			fakeBinding(false),
		);
		expect(plain?.status).toBe(429);
		expect(plain?.headers.get("Cache-Control")).toBeNull();
	});
});
