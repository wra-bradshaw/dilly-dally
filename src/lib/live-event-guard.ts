import { isCrossOrigin, jsonError } from "./api-errors";
import type { DillyEvent, DrizzleDb } from "./db";
import { getDb } from "./db-env";
import { liveEventErrorResponse, loadLiveEvent } from "./server-event-detail";
import { guardRateLimit } from "./server-rate-limit";

export type LiveEventContext = {
	db: DrizzleDb;
	event: DillyEvent;
	now: number;
};

// Response precedence: rate-limit (429) → cross-origin (403) → event load
// (404/410). Body parsing (400) happens in callers after this returns, so
// missing events report 404 before malformed bodies report 400.
// Cross-origin requests skip the event load entirely: the sync origin check
// runs first and only the rate limit still executes, preserving 429
// precedence without spending a D1 round-trip on a rejected request.
// Allowed requests run the rate check and the event load concurrently.
export async function withLiveEvent(
	request: Request,
	eventId: string,
	scope: string,
	budget: { limit: number; windowMs: number },
): Promise<LiveEventContext | { response: Response }> {
	const db = getDb();
	const now = Date.now();
	if (isCrossOrigin(request)) {
		const throttled = await guardRateLimit(request, scope, budget);
		if (throttled) return { response: throttled };
		return {
			response: jsonError("bad_request", "Cross-origin request rejected", 403),
		};
	}
	const [throttled, loaded] = await Promise.all([
		guardRateLimit(request, scope, budget),
		loadLiveEvent(db, eventId, now),
	]);
	if (throttled) return { response: throttled };
	if (!loaded.ok) return { response: liveEventErrorResponse(loaded) };
	return { db, event: loaded.event, now };
}
