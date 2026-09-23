import { DurableObject } from "cloudflare:workers";
import {
	decideRateLimit,
	type RateLimitResult,
	type RateLimitState,
} from "./rate-limit";

interface RateLimiterRow {
	count: number;
	window_start: number;
}

export class RateLimiter extends DurableObject<Env> {
	private cached: RateLimitState | null | undefined = undefined;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.ctx.storage.sql.exec(
				"CREATE TABLE IF NOT EXISTS counters (id INTEGER PRIMARY KEY CHECK (id = 1), count INTEGER NOT NULL, window_start INTEGER NOT NULL)",
			);
		});
	}

	async check(
		nowMs: number,
		windowMs: number,
		limit: number,
	): Promise<RateLimitResult> {
		let stored = this.cached;
		if (stored === undefined) {
			const rows = this.ctx.storage.sql
				.exec<RateLimiterRow>(
					"SELECT count, window_start FROM counters WHERE id = 1",
				)
				.toArray();
			const row = rows[0];
			stored = row === undefined ? null : { count: row.count, windowStart: row.window_start };
			this.cached = stored;
		}
		const { next, result } = decideRateLimit(stored, nowMs, windowMs, limit);
		this.ctx.storage.sql.exec(
			"INSERT INTO counters (id, count, window_start) VALUES (1, ?, ?) ON CONFLICT (id) DO UPDATE SET count = excluded.count, window_start = excluded.window_start",
			next.count,
			next.windowStart,
		);
		this.cached = next;
		return result;
	}
}
