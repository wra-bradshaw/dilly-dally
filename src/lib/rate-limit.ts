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

export function isRateLimited(args: {
	count: number;
	limit: number;
	windowStart: number;
}): boolean {
	return args.count >= args.limit;
}

export const RATE_LIMITS = {
	availabilityWrite: { limit: 30, windowMs: 60_000 },
	createEvent: { limit: 10, windowMs: 3_600_000 },
	read: { limit: 120, windowMs: 60_000 },
} as const;
