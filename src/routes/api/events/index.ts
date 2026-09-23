import { createFileRoute } from "@tanstack/react-router";
import {
	clientIp,
	contentLengthTooLarge,
	isJsonContentType,
	jsonError,
	originOf,
	rateLimited,
	zodFields,
} from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS, rateLimitKey } from "#/lib/rate-limit";
import { createEventInDb, toEventDto } from "#/lib/server-events";
import { checkRateLimit } from "#/lib/server-rate-limit";
import { createEventSchema } from "#/lib/validation";

export const Route = createFileRoute("/api/events/")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const db = getDb();
				const now = Date.now();
				const key = await rateLimitKey(clientIp(request), "create_event");
				const rl = await checkRateLimit(
					key,
					now,
					RATE_LIMITS.createEvent.windowMs,
					RATE_LIMITS.createEvent.limit,
				);
				if (!rl.allowed) return rateLimited(rl.resetMs);
				if (contentLengthTooLarge(request))
					return jsonError("bad_request", "Payload too large", 413);
				if (!isJsonContentType(request))
					return jsonError(
						"bad_request",
						"Content-Type must be application/json",
						415,
					);
				let raw: unknown;
				try {
					raw =
						(await request.json()) as components["schemas"]["CreateEventRequest"];
				} catch {
					return jsonError("bad_request", "Invalid JSON", 400);
				}
				const parsed = createEventSchema.safeParse(raw);
				if (!parsed.success) {
					return jsonError(
						"bad_request",
						"Validation failed",
						400,
						zodFields(parsed.error),
					);
				}
				const event = await createEventInDb(db, parsed.data, now);
				if (!event) return jsonError("internal", "Could not create event", 500);
				const res: components["schemas"]["CreateEventResponse"] = {
					event: toEventDto(event),
					id: event.id,
					url: `${originOf(request)}/e/${event.id}`,
				};
				return Response.json(res, { status: 201 });
			},
		},
	},
});
