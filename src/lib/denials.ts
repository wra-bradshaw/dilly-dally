export function retryAfterSeconds(resetMs: number, now: number): number {
	return Math.max(1, Math.ceil((resetMs - now) / 1000));
}

export type LiveEventCode = "gone" | "not_found";

export function liveEventDenial(code: LiveEventCode): {
	code: LiveEventCode;
	message: string;
	status: 404 | 410;
} {
	return code === "gone"
		? { code, message: "Event has expired", status: 410 }
		: { code, message: "Event not found", status: 404 };
}
