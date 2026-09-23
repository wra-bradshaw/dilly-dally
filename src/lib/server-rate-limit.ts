import { sql } from "drizzle-orm";
import type { DrizzleDb } from "./db";
import { windowStartFor } from "./rate-limit";
import { rateCounters } from "./schema";

export async function checkRateLimitDb(
	db: DrizzleDb,
	key: string,
	nowMs: number,
	windowMs: number,
	limit: number,
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
	const ws = windowStartFor(nowMs, windowMs);
	const rows = await db
		.insert(rateCounters)
		.values({ count: 1, key, windowStart: ws })
		.onConflictDoUpdate({
			set: {
				count: sql`CASE WHEN ${rateCounters.windowStart} != ${ws} THEN 1 ELSE ${rateCounters.count} + 1 END`,
				windowStart: ws,
			},
			target: rateCounters.key,
		})
		.returning({ count: rateCounters.count });
	const count = rows[0]?.count ?? 1;
	return {
		allowed: count <= limit,
		remaining: Math.max(0, limit - count),
		resetMs: ws + windowMs,
	};
}
