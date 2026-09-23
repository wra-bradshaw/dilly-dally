export const DAY_MS = 24 * 60 * 60 * 1000;
export const EVENT_MAX_FUTURE_DAYS = 91;
export const EVENT_GRACE_DAYS = 2;
export const EVENT_TTL_DAYS = EVENT_MAX_FUTURE_DAYS + EVENT_GRACE_DAYS;

export function computeExpiry(args: {
	createdAt: number;
	dates: string[];
	mode?: string;
	weekdays?: number[];
}): number {
	const cap = args.createdAt + EVENT_TTL_DAYS * DAY_MS;
	if ((args.mode ?? "dates") === "weekly") return cap;
	const lastDate = [...args.dates].sort().at(-1);
	if (!lastDate) return cap;
	const graceEnd =
		new Date(`${lastDate}T00:00:00.000Z`).getTime() +
		EVENT_GRACE_DAYS * DAY_MS;
	return Math.min(cap, graceEnd);
}

export function isExpired(expiresAt: number, now: number): boolean {
	return now >= expiresAt;
}
