import { createFileRoute } from "@tanstack/react-router";
import { jsonError, securityHeaders } from "#/lib/api-errors";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS } from "#/lib/rate-limit";
import {
	liveEventErrorResponse,
	loadLiveEvent,
} from "#/lib/server-event-detail";
import { deletePollOptionInDb } from "#/lib/server-polls";
import { guardRateLimit } from "#/lib/server-rate-limit";

export async function deletePollOptionHandler(
	request: Request,
	eventId: string,
	pollId: string,
	optionId: string,
): Promise<Response> {
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(
		request,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if (throttled) return throttled;
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) return liveEventErrorResponse(loaded);
	const res = await deletePollOptionInDb(db, eventId, pollId, optionId);
	if (!res.ok && res.code === "not_found")
		return jsonError("not_found", "Option not found", 404);
	if (!res.ok && res.code === "has_votes")
		return jsonError(
			"has_votes",
			"Cannot remove an option that already has votes",
			409,
		);
	if (!res.ok && res.code === "too_few_options")
		return jsonError("too_few_options", "Polls need at least two options", 409);
	if (!res.ok) return jsonError("internal", "Could not delete option", 500);
	return Response.json({ ok: true }, { headers: securityHeaders() });
}

export const Route = createFileRoute(
	"/api/events/$eventId/polls/$pollId/options/$optionId",
)({
	server: {
		handlers: {
			DELETE: ({ params, request }) =>
				deletePollOptionHandler(
					request,
					params.eventId,
					params.pollId,
					params.optionId,
				),
		},
	},
});
