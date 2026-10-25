import { createFileRoute } from "@tanstack/react-router";
import { jsonError, readGuardedJson, securityHeaders } from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { withLiveEvent } from "#/lib/live-event-guard";
import { RATE_LIMITS } from "#/lib/rate-limit";
import { createPollInDb } from "#/lib/server-polls";
import { createPollSchema } from "#/lib/validation";

export async function createPollHandler(
	request: Request,
	eventId: string,
): Promise<Response> {
	const ctx = await withLiveEvent(
		request,
		eventId,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if ("response" in ctx) return ctx.response;
	const { db, event, now } = ctx;
	const guarded = await readGuardedJson(request, createPollSchema);
	if (!guarded.ok) return guarded.response;
	const res = await createPollInDb(db, event.id, guarded.data, now);
	if (!res.ok && res.code === "too_many_polls")
		return jsonError("too_many_polls", "This event already has 10 polls", 409);
	if (!res.ok && res.code === "duplicate_question")
		return jsonError(
			"duplicate_poll",
			"A poll with this question already exists",
			409,
		);
	if (!res.ok && res.code === "duplicate_option")
		return jsonError("duplicate_option", "Poll options must be unique", 409);
	if (!res.ok) return jsonError("internal", "Could not create poll", 500);
	const out: components["schemas"]["CreatePollResponse"] = {
		poll: {
			allowMultiple: res.poll.allowMultiple,
			id: res.poll.id,
			options: res.poll.options.map((o) => ({
				count: o.count,
				id: o.id,
				label: o.label,
				names: o.names,
			})),
			question: res.poll.question,
			totalVoters: res.poll.totalVoters,
		},
	};
	return Response.json(out, { headers: securityHeaders(), status: 201 });
}

export const Route = createFileRoute("/api/events/$eventId/polls")({
	server: {
		handlers: {
			POST: ({ params, request }) => createPollHandler(request, params.eventId),
		},
	},
});
