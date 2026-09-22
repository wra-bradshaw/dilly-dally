import { createFileRoute } from "@tanstack/react-router";
import { clientIp, jsonError, rateLimited } from "#/lib/api-errors";
import type { EventDetailResponse } from "#/lib/api-types";
import { deleteEvent, fetchEvent } from "#/lib/db";
import { getDb } from "#/lib/db-env";
import { isValidEventId } from "#/lib/event-ids";
import { isExpired } from "#/lib/expiry";
import { RATE_LIMITS, rateLimitKey } from "#/lib/rate-limit";
import { getEventDetail } from "#/lib/server-availability";
import { checkRateLimitDb } from "#/lib/server-rate-limit";

export const Route = createFileRoute("/api/events/$eventId/")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const db = getDb();
				const key = await rateLimitKey(clientIp(request), "read");
				const rl = await checkRateLimitDb(
					db,
					key,
					Date.now(),
					RATE_LIMITS.read.windowMs,
					RATE_LIMITS.read.limit,
				);
				if (!rl.allowed) return rateLimited(rl.resetMs);
				if (!isValidEventId(params.eventId)) {
					return jsonError("not_found", "Event not found", 404);
				}
				const event = await fetchEvent(db, params.eventId);
				if (!event) return jsonError("not_found", "Event not found", 404);
				if (isExpired(event.expiresAt, Date.now())) {
					await deleteEvent(db, event.id);
					return jsonError("gone", "Event has expired", 410);
				}
				const detail: EventDetailResponse = await getEventDetail(db, event);
				return Response.json(detail, {
					headers: { "Cache-Control": "no-store" },
				});
			},
		},
	},
});
