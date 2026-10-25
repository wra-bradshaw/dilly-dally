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

// Guard order: rate-limit (429) → cross-origin (403) → event load (404/410).
// Body parsing (400) happens in callers after this returns, so missing
// events report 404 before malformed bodies report 400. Cross-origin writes
// are rejected on all routes using this helper.
export async function withLiveEvent(
	request: Request,
	eventId: string,
	scope: string,
	budget: { limit: number; windowMs: number },
): Promise<LiveEventContext | { response: Response }> {
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(request, scope, budget);
	if (throttled) return { response: throttled };
	if (isCrossOrigin(request))
		return {
			response: jsonError("bad_request", "Cross-origin request rejected", 403),
		};
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) return { response: liveEventErrorResponse(loaded) };
	return { db, event: loaded.event, now };
}
