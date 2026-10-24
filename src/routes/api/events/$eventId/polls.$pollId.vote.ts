import { createFileRoute } from "@tanstack/react-router";
import { jsonError, readGuardedJson, securityHeaders } from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS } from "#/lib/rate-limit";
import {
	liveEventErrorResponse,
	loadLiveEvent,
} from "#/lib/server-event-detail";
import { listPollsDetail, votePollInDb } from "#/lib/server-polls";
import { guardRateLimit } from "#/lib/server-rate-limit";
import { type PollVoteInput, pollVoteSchema } from "#/lib/validation";

export async function votePollHandler(
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
	const guarded = await readGuardedJson(request, pollVoteSchema);
	if (!guarded.ok) return guarded.response;
	const input: PollVoteInput = guarded.data;
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) return liveEventErrorResponse(loaded);
	const res = await votePollInDb(db, loaded.event, pollId, input, now);
	if (!res.ok && res.code === "not_found")
		return jsonError("not_found", "Poll not found", 404);
	if (!res.ok && res.code === "invalid_password")
		return jsonError("invalid_password", "Wrong password for this name", 401);
	if (
		!res.ok &&
		(res.code === "invalid_option" || res.code === "invalid_selection")
	)
		return jsonError("invalid_option", "Invalid poll selection", 422);
	if (!res.ok) return jsonError("internal", "Could not save vote", 500);
	const polls = await listPollsDetail(db, eventId);
	const poll = polls.find((p) => p.id === pollId);
	const out: components["schemas"]["PollVoteResponse"] = {
		pollId,
		totalVoters: poll?.totalVoters ?? 0,
	};
	return Response.json(out, { headers: securityHeaders() });
}

export const Route = createFileRoute("/api/events/$eventId/polls/$pollId/vote")(
	{
		server: {
			handlers: {
				POST: ({ params, request }) =>
					votePollHandler(request, params.eventId, params.pollId),
				PUT: ({ params, request }) =>
					votePollHandler(request, params.eventId, params.pollId),
			},
		},
	},
);
