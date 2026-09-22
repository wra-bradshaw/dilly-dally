import { eq } from "drizzle-orm";
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
		.select()
		.from(rateCounters)
		.where(eq(rateCounters.key, key));
	const row = rows[0];
	if (!row || row.windowStart !== ws) {
		await db
			.insert(rateCounters)
			.values({ count: 1, key, windowStart: ws })
			.onConflictDoUpdate({
				set: { count: 1, windowStart: ws },
				target: rateCounters.key,
			});
		return { allowed: true, remaining: limit - 1, resetMs: ws + windowMs };
	}
	if (row.count >= limit) {
		return { allowed: false, remaining: 0, resetMs: ws + windowMs };
	}
	await db
		.update(rateCounters)
		.set({ count: row.count + 1 })
		.where(eq(rateCounters.key, key));
	return {
		allowed: true,
		remaining: limit - row.count - 1,
		resetMs: ws + windowMs,
	};
}
