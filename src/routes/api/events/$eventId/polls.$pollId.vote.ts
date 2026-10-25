import { createFileRoute } from "@tanstack/react-router";
import { jsonError, readGuardedJson, securityHeaders } from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { withLiveEvent } from "#/lib/live-event-guard";
import { RATE_LIMITS } from "#/lib/rate-limit";
import { votePollInDb } from "#/lib/server-polls";
import { trySessionNameKey } from "#/lib/server-sessions";
import { type PollVoteInput, pollVoteSchema } from "#/lib/validation";

export async function votePollHandler(
	request: Request,
	eventId: string,
	pollId: string,
): Promise<Response> {
	const ctx = await withLiveEvent(
		request,
		eventId,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if ("response" in ctx) return ctx.response;
	const { db, event, now } = ctx;
	const guarded = await readGuardedJson(request, pollVoteSchema);
	if (!guarded.ok) return guarded.response;
	const input: PollVoteInput = guarded.data;
	const sessionNameKey = await trySessionNameKey(
		db,
		event.id,
		request.headers.get("cookie"),
		input.name,
		now,
	);
	const res = await votePollInDb(
		db,
		event,
		pollId,
		input,
		now,
		undefined,
		sessionNameKey ? { sessionNameKey } : {},
	);
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
	const out: components["schemas"]["PollVoteResponse"] = { pollId };
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
