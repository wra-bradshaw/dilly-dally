import { createFileRoute } from "@tanstack/react-router";
import { jsonError, readGuardedJson, securityHeaders } from "#/lib/api-errors";
import { getDb } from "#/lib/db-env";
import {
	buildSessionCookie,
	clearSessionCookie,
	isSecureRequest,
	parseSessionCookie,
} from "#/lib/event-cookies";
import { withLiveEvent } from "#/lib/live-event-guard";
import { RATE_LIMITS } from "#/lib/rate-limit";
import { getOwnAvailability } from "#/lib/server-availability";
import {
	liveEventErrorResponse,
	loadLiveEvent,
} from "#/lib/server-event-detail";
import { guardRateLimit } from "#/lib/server-rate-limit";
import {
	createEventSession,
	resolveEventSession,
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

export async function getOwnSessionResponse(
	eventId: string,
	request: Request,
): Promise<Response> {
	const noStore = { noStore: true } as const;
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(request, "read", RATE_LIMITS.read, {
		noStore: true,
	});
	if (throttled) return throttled;
	const token = parseSessionCookie(request.headers.get("cookie"), eventId);
	if (!token)
		return jsonError(
			"not_found",
			"No session for this event",
			404,
			undefined,
			noStore,
		);
	const resolved = await resolveEventSession(db, token, now);
	if (!resolved.ok || resolved.eventId !== eventId)
		return jsonError(
			"not_found",
			"No session for this event",
			404,
			undefined,
			noStore,
		);
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) return liveEventErrorResponse(loaded, noStore);
	const own = await getOwnAvailability(
		db,
		loaded.event,
		resolved.name,
		null,
		undefined,
		{
			sessionNameKey: resolved.nameKey,
		},
	);
	if (!own.ok)
		return jsonError(
			"not_found",
			"No session for this event",
			404,
			undefined,
			noStore,
		);
	return Response.json(
		{ name: own.name, slots: own.slots },
		{
			headers: {
				...securityHeaders(),
				"Cache-Control": "no-store",
			},
		},
	);
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
			GET: ({ params, request }) =>
				getOwnSessionResponse(params.eventId, request),
			POST: ({ params, request }) =>
				createSessionResponse(params.eventId, request),
		},
	},
});
