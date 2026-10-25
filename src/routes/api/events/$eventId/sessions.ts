import { createFileRoute } from "@tanstack/react-router";
import { jsonError, readGuardedJson, securityHeaders } from "#/lib/api-errors";
import {
	buildSessionCookie,
	clearSessionCookie,
	isSecureRequest,
	parseSessionCookie,
} from "#/lib/event-cookies";
import { withLiveEvent } from "#/lib/live-event-guard";
import { RATE_LIMITS } from "#/lib/rate-limit";
import {
	createEventSession,
	revokeEventSession,
	SESSION_TTL_MS,
} from "#/lib/server-sessions";
import { type SessionCreateInput, sessionCreateSchema } from "#/lib/validation";

export async function createSessionResponse(
	eventId: string,
	request: Request,
): Promise<Response> {
	const ctx = await withLiveEvent(
		request,
		eventId,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if ("response" in ctx) return ctx.response;
	const { db, event, now } = ctx;
	const guarded = await readGuardedJson(request, sessionCreateSchema);
	if (!guarded.ok) return guarded.response;
	const input: SessionCreateInput = guarded.data;
	const res = await createEventSession(
		db,
		event,
		input.name,
		input.password ?? null,
		now,
	);
	if (!res.ok && res.code === "invalid_password")
		return jsonError("invalid_password", "Wrong password for this name", 401);
	if (!res.ok) return jsonError("bad_request", "Name is required", 400);
	const secure = isSecureRequest(request);
	const headers = {
		...securityHeaders(),
		"Cache-Control": "no-store",
		"Set-Cookie": buildSessionCookie(
			eventId,
			res.token,
			secure,
			Math.floor(SESSION_TTL_MS / 1000),
		),
	};
	return Response.json({ name: res.name }, { headers, status: 201 });
}

export async function deleteSessionResponse(
	eventId: string,
	request: Request,
): Promise<Response> {
	const ctx = await withLiveEvent(
		request,
		eventId,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if ("response" in ctx) return ctx.response;
	const { db } = ctx;
	const token = parseSessionCookie(request.headers.get("cookie"), eventId);
	if (token) await revokeEventSession(db, token);
	const secure = isSecureRequest(request);
	return Response.json(
		{},
		{
			headers: {
				...securityHeaders(),
				"Cache-Control": "no-store",
				"Set-Cookie": clearSessionCookie(eventId, secure),
			},
		},
	);
}

export const Route = createFileRoute("/api/events/$eventId/sessions")({
	server: {
		handlers: {
			DELETE: ({ params, request }) =>
				deleteSessionResponse(params.eventId, request),
			POST: ({ params, request }) =>
				createSessionResponse(params.eventId, request),
		},
	},
});
