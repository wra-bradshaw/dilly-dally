import { env } from "cloudflare:workers";
import { clientIp, rateLimited } from "./api-errors";
import { type RateLimitResult, rateLimitKey } from "./rate-limit";

export function bindingForScope(
	scope: string,
	bindings: Record<string, RateLimit | undefined> = env as unknown as Record<
		string,
		RateLimit | undefined
	>,
): RateLimit {
	if (scope === "read") return bindings.READ_LIMITER as RateLimit;
	if (scope === "create_event")
		return bindings.CREATE_EVENT_LIMITER as RateLimit;
	if (scope === "availability_write")
		return bindings.AVAIL_WRITE_LIMITER as RateLimit;
	throw new Error(`unknown rate limit scope: ${scope}`);
}

function resetMsFor(windowMs: number, now: number = Date.now()): number {
	return Math.floor(now / windowMs) * windowMs + windowMs;
}

export async function checkRateLimit(
	key: string,
	scope: string,
	windowMs: number,
	limiter?: RateLimit,
): Promise<RateLimitResult> {
	const binding = limiter ?? bindingForScope(scope);
	const { success } = await binding.limit({ key });
	return {
		allowed: success,
		remaining: success ? 1 : 0,
		resetMs: resetMsFor(windowMs),
	};
}

export async function doRateLimit(
	request: Request,
	scope: string,
	budget: { limit: number; windowMs: number },
	limiter?: RateLimit,
): Promise<RateLimitResult> {
	const key = await rateLimitKey(clientIp(request), scope);
	return checkRateLimit(
		key,
		scope,
		budget.windowMs,
		limiter ?? bindingForScope(scope),
	);
}

export async function guardRateLimit(
	request: Request,
	scope: string,
	budget: { limit: number; windowMs: number },
	opts?: { noStore?: boolean },
	limiter?: RateLimit,
): Promise<Response | null> {
	const result = await doRateLimit(
		request,
		scope,
		budget,
		limiter ?? bindingForScope(scope),
	);
	if (!result.allowed) return rateLimited(result.resetMs, opts);
	return null;
}
