const DAY_MS = 24 * 60 * 60 * 1000;

export function computeExpiry(args: {
	createdAt: number;
	dates: string[];
	mode?: string;
	weekdays?: number[];
}): number {
	if ((args.mode ?? "dates") === "weekly") return args.createdAt + 90 * DAY_MS;
	const lastDate = [...args.dates].sort().at(-1);
	if (!lastDate) return args.createdAt + 90 * DAY_MS;
	const graceEnd = new Date(`${lastDate}T00:00:00.000Z`).getTime() + DAY_MS;
	return Math.min(args.createdAt + 90 * DAY_MS, graceEnd);
}

export function isExpired(expiresAt: number, now: number): boolean {
	return now >= expiresAt;
}
