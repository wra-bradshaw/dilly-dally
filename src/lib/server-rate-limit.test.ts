import { describe, expect, it } from "vitest";
import { decideRateLimit, type RateLimitState } from "./rate-limit";
import { RateLimiter } from "./rate-limiter-do";
import { checkRateLimit } from "./server-rate-limit";

describe("decideRateLimit", () => {
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

function createFakeStorage() {
	let row: { count: number; window_start: number } | null = null;
	const sql = {
		exec(query: string, ...bindings: Array<string | number>) {
			if (query.startsWith("CREATE TABLE")) return { toArray: () => [] };
			if (query.startsWith("SELECT"))
				return { toArray: () => (row === null ? [] : [{ ...row }]) };
			if (query.startsWith("INSERT")) {
				row = {
					count: bindings[0] as number,
					window_start: bindings[1] as number,
				};
				return { toArray: () => [] };
			}
			throw new Error(`unexpected query ${query}`);
		},
	};
	const ctx = {
		blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => callback(),
		storage: { sql },
	};
	return { ctx, peek: () => row };
}

function createLimiter(storage: ReturnType<typeof createFakeStorage>) {
	return new RateLimiter(
		storage.ctx as unknown as DurableObjectState,
		{} as unknown as Env,
	);
}

describe("RateLimiter", () => {
	it("allows up to the limit then blocks within a window", async () => {
		const storage = createFakeStorage();
		const limiter = createLimiter(storage);
		for (let i = 0; i < 3; i++) {
			expect((await limiter.check(i * 1000, 60_000, 3)).allowed).toBe(true);
		}
		const blocked = await limiter.check(4000, 60_000, 3);
		expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
		expect(storage.peek()).toMatchObject({ count: 4 });
	});

	it("shares counters across instances on the same storage", async () => {
		const storage = createFakeStorage();
		await createLimiter(storage).check(1000, 60_000, 2);
		const reloaded = createLimiter(storage);
		expect((await reloaded.check(2000, 60_000, 2)).allowed).toBe(true);
		expect((await createLimiter(storage).check(3000, 60_000, 2)).allowed).toBe(
			false,
		);
	});

	it("resets in a new window even after reload", async () => {
		const storage = createFakeStorage();
		await createLimiter(storage).check(1000, 60_000, 1);
		const reloaded = createLimiter(storage);
		const next = await reloaded.check(61_000, 60_000, 1);
		expect(next).toMatchObject({ allowed: true, resetMs: 120_000 });
	});
});

function createFakeNamespace() {
	const states = new Map<string, RateLimitState | null>();
	const tails = new Map<string, Promise<void>>();
	return {
		getByName(key: string) {
			return {
				check: (nowMs: number, windowMs: number, limit: number) => {
					const prev = tails.get(key) ?? Promise.resolve();
					const run = prev.then(() => {
						const { next, result } = decideRateLimit(
							states.get(key) ?? null,
							nowMs,
							windowMs,
							limit,
						);
						states.set(key, next);
						return result;
					});
					tails.set(
						key,
						run.then(() => undefined),
					);
					return run;
				},
			};
		},
	};
}

function fakeNamespace() {
	return createFakeNamespace() as unknown as DurableObjectNamespace<RateLimiter>;
}

describe("checkRateLimit", () => {
	it("routes per key so keys are isolated", async () => {
		const namespace = fakeNamespace();
		for (let i = 0; i < 2; i++) {
			expect((await checkRateLimit("a", i, 60_000, 2, namespace)).allowed).toBe(
				true,
			);
		}
		expect((await checkRateLimit("a", 10, 60_000, 2, namespace)).allowed).toBe(
			false,
		);
		expect((await checkRateLimit("b", 10, 60_000, 2, namespace)).allowed).toBe(
			true,
		);
	});

	it("allows exactly the limit on a concurrent burst", async () => {
		const namespace = fakeNamespace();
		const results = await Promise.all(
			Array.from({ length: 5 }, () =>
				checkRateLimit("burst", 1000, 60_000, 3, namespace),
			),
		);
		expect(results.filter((r) => r.allowed)).toHaveLength(3);
		expect(results.filter((r) => !r.allowed)).toHaveLength(2);
	});
});
