export async function rateLimitKey(ip: string, scope: string): Promise<string> {
	const data = new TextEncoder().encode(`${scope}|${ip}`);
	const digest = await crypto.subtle.digest("SHA-256", data);
	const bytes = new Uint8Array(digest);
	let hex = "";
	for (const b of bytes) hex += b.toString(16).padStart(2, "0");
	return `${scope}:${hex.slice(0, 32)}`;
}

export function windowStartFor(nowMs: number, windowMs: number): number {
	return Math.floor(nowMs / windowMs) * windowMs;
}

export const RATE_LIMITS = {
	availabilityWrite: { limit: 30, windowMs: 60_000 },
	createEvent: { limit: 10, windowMs: 3_600_000 },
	read: { limit: 120, windowMs: 60_000 },
} as const;

export interface RateLimitState {
	count: number;
	windowStart: number;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetMs: number;
}

export function decideRateLimit(
	stored: RateLimitState | null,
	nowMs: number,
	windowMs: number,
	limit: number,
): { next: RateLimitState; result: RateLimitResult } {
	const ws = windowStartFor(nowMs, windowMs);
	const count =
		stored !== null && stored.windowStart === ws ? stored.count + 1 : 1;
	return {
		next: { count, windowStart: ws },
		result: {
			allowed: count <= limit,
			remaining: Math.max(0, limit - count),
			resetMs: ws + windowMs,
		},
	};
}
