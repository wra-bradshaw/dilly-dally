import { createFileRoute } from "@tanstack/react-router";
import { clientIp, jsonError, rateLimited } from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS, rateLimitKey } from "#/lib/rate-limit";
import { getEventDetail } from "#/lib/server-availability";
import { loadLiveEvent } from "#/lib/server-event-detail";
import { checkRateLimitDb } from "#/lib/server-rate-limit";

export const Route = createFileRoute("/api/events/$eventId/")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const db = getDb();
				const now = Date.now();
				const key = await rateLimitKey(clientIp(request), "read");
				const rl = await checkRateLimitDb(
					db,
					key,
					now,
					RATE_LIMITS.read.windowMs,
					RATE_LIMITS.read.limit,
				);
				if (!rl.allowed) return rateLimited(rl.resetMs);
				const loaded = await loadLiveEvent(db, params.eventId, now);
				if (!loaded.ok) {
					return jsonError(
						loaded.code,
						loaded.code === "gone" ? "Event has expired" : "Event not found",
						loaded.status,
					);
				}
				const detail: components["schemas"]["EventDetailResponse"] =
					await getEventDetail(db, loaded.event);
				return Response.json(detail, {
					headers: { "Cache-Control": "no-store" },
				});
			},
		},
	},
});
