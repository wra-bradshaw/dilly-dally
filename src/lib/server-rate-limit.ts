import { env } from "cloudflare:workers";
import type { RateLimitResult } from "./rate-limit";
import type { RateLimiter } from "./rate-limiter-do";

export type { RateLimitResult };

export async function checkRateLimit(
	key: string,
	nowMs: number,
	windowMs: number,
	limit: number,
	namespace: DurableObjectNamespace<RateLimiter> = env.RATE_LIMITER,
): Promise<RateLimitResult> {
	const stub = namespace.getByName(key);
	return stub.check(nowMs, windowMs, limit);
}
