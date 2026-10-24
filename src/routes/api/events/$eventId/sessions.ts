import { createFileRoute } from "@tanstack/react-router";
import {
	isCrossOrigin,
	jsonError,
	readGuardedJson,
	securityHeaders,
} from "#/lib/api-errors";
import { getDb } from "#/lib/db-env";
import {
	buildSessionCookie,
	clearSessionCookie,
	isSecureRequest,
	parseSessionCookie,
} from "#/lib/event-cookies";
import { RATE_LIMITS } from "#/lib/rate-limit";
import {
	liveEventErrorResponse,
	loadLiveEvent,
} from "#/lib/server-event-detail";
import { guardRateLimit } from "#/lib/server-rate-limit";
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
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(
		request,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if (throttled) return throttled;
	if (isCrossOrigin(request))
		return jsonError("bad_request", "Cross-origin request rejected", 403);
	const guarded = await readGuardedJson(request, sessionCreateSchema);
	if (!guarded.ok) return guarded.response;
	const input: SessionCreateInput = guarded.data;
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) return liveEventErrorResponse(loaded);
	const res = await createEventSession(
		db,
		loaded.event,
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
	const throttled = await guardRateLimit(
		request,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if (throttled) return throttled;
	if (isCrossOrigin(request))
		return jsonError("bad_request", "Cross-origin request rejected", 403);
	const db = getDb();
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
