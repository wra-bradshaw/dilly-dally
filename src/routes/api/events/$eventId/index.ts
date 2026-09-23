import { createFileRoute } from "@tanstack/react-router";
import { clientIp, jsonError, rateLimited } from "#/lib/api-errors";
import { HttpError } from "#/lib/http-error";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS, rateLimitKey } from "#/lib/rate-limit";
import { loadEventDetailFromDb } from "#/lib/server-event-detail";
import { checkRateLimit } from "#/lib/server-rate-limit";

export const Route = createFileRoute("/api/events/$eventId/")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const db = getDb();
				const now = Date.now();
				const key = await rateLimitKey(clientIp(request), "read");
				const rl = await checkRateLimit(
					key,
					now,
					RATE_LIMITS.read.windowMs,
					RATE_LIMITS.read.limit,
				);
				if (!rl.allowed) return rateLimited(rl.resetMs);
				try {
					const detail = await loadEventDetailFromDb(
						db,
						params.eventId,
						now,
					);
					return Response.json(detail, {
						headers: { "Cache-Control": "no-store" },
					});
				} catch (err) {
					if (err instanceof HttpError) {
						return jsonError(err.code, err.message, err.status);
					}
					throw err;
				}
			},
		},
	},
});
