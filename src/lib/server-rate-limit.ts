import { env } from "cloudflare:workers";
import { clientIp, rateLimited } from "./api-errors";
import { type RateLimitResult, rateLimitKey } from "./rate-limit";
import type { RateLimiter } from "./rate-limiter-do";

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

export async function guardRateLimit(
	request: Request,
	scope: string,
	budget: { limit: number; windowMs: number },
	opts?: { noStore?: boolean },
	namespace: DurableObjectNamespace<RateLimiter> = env.RATE_LIMITER,
): Promise<Response | null> {
	const key = await rateLimitKey(clientIp(request), scope);
	const result = await checkRateLimit(
		key,
		Date.now(),
		budget.windowMs,
		budget.limit,
		namespace,
	);
	if (!result.allowed) return rateLimited(result.resetMs, opts);
	return null;
}
