import { createFileRoute } from "@tanstack/react-router";
import { jsonError, securityHeaders } from "#/lib/api-errors";
import { withLiveEvent } from "#/lib/live-event-guard";
import { RATE_LIMITS } from "#/lib/rate-limit";
import { deletePollOptionInDb } from "#/lib/server-polls";

export async function deletePollOptionHandler(
	request: Request,
	eventId: string,
	pollId: string,
	optionId: string,
): Promise<Response> {
	const ctx = await withLiveEvent(
		request,
		eventId,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if ("response" in ctx) return ctx.response;
	const { db, event } = ctx;
	const res = await deletePollOptionInDb(db, event.id, pollId, optionId);
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
