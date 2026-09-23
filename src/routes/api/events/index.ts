import { createFileRoute } from "@tanstack/react-router";
import {
	jsonError,
	originOf,
	readGuardedJson,
	securityHeaders,
} from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS } from "#/lib/rate-limit";
import { createEventInDb, toEventDto } from "#/lib/server-events";
import { guardRateLimit } from "#/lib/server-rate-limit";
import { createEventSchema } from "#/lib/validation";

export async function handleCreate(request: Request): Promise<Response> {
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(
		request,
		"create_event",
		RATE_LIMITS.createEvent,
	);
	if (throttled) return throttled;
	const guarded = await readGuardedJson(request, createEventSchema);
	if (!guarded.ok) return guarded.response;
	const event = await createEventInDb(db, guarded.data, now);
	if (!event) return jsonError("internal", "Could not create event", 500);
	const res: components["schemas"]["CreateEventResponse"] = {
		event: toEventDto(event),
		id: event.id,
		url: `${originOf(request)}/e/${event.id}`,
	};
	return Response.json(res, { headers: securityHeaders(), status: 201 });
}

export const Route = createFileRoute("/api/events/")({
	server: {
		handlers: {
			POST: ({ request }) => handleCreate(request),
		},
	},
});
