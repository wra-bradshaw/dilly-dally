import { createFileRoute } from "@tanstack/react-router";
import { jsonError, readGuardedJson, securityHeaders } from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS } from "#/lib/rate-limit";
import {
	liveEventErrorResponse,
	loadLiveEvent,
} from "#/lib/server-event-detail";
import { addPollOptionInDb } from "#/lib/server-polls";
import { guardRateLimit } from "#/lib/server-rate-limit";
import { addPollOptionSchema } from "#/lib/validation";

export async function addPollOptionHandler(
	request: Request,
	eventId: string,
	pollId: string,
): Promise<Response> {
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(
		request,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if (throttled) return throttled;
	const guarded = await readGuardedJson(request, addPollOptionSchema);
	if (!guarded.ok) return guarded.response;
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) return liveEventErrorResponse(loaded);
	const res = await addPollOptionInDb(
		db,
		eventId,
		pollId,
		guarded.data.label,
		now,
	);
	if (!res.ok && res.code === "not_found")
		return jsonError("not_found", "Poll not found", 404);
	if (!res.ok && res.code === "too_many_options")
		return jsonError(
			"too_many_options",
			"This poll already has 10 options",
			409,
		);
	if (!res.ok && res.code === "duplicate_option")
		return jsonError("duplicate_option", "This option already exists", 409);
	if (!res.ok) return jsonError("internal", "Could not add option", 500);
	const out: components["schemas"]["AddPollOptionResponse"] = {
		id: res.optionId,
		label: guarded.data.label.trim(),
	};
	return Response.json(out, { headers: securityHeaders(), status: 201 });
}

export const Route = createFileRoute(
	"/api/events/$eventId/polls/$pollId/options",
)({
	server: {
		handlers: {
			POST: ({ params, request }) =>
				addPollOptionHandler(request, params.eventId, params.pollId),
		},
	},
});
