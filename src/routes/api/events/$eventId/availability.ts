import { createFileRoute } from "@tanstack/react-router";
import { jsonError, readGuardedJson, securityHeaders } from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS } from "#/lib/rate-limit";
import {
	getOwnAvailability,
	upsertAvailability,
} from "#/lib/server-availability";
import {
	liveEventErrorResponse,
	loadLiveEvent,
} from "#/lib/server-event-detail";
import { guardRateLimit } from "#/lib/server-rate-limit";
import { type AvailabilityInput, availabilitySchema } from "#/lib/validation";

export async function saveAvailability(
	request: Request,
	eventId: string,
): Promise<Response> {
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(
		request,
		"availability_write",
		RATE_LIMITS.availabilityWrite,
	);
	if (throttled) return throttled;
	const guarded = await readGuardedJson(request, availabilitySchema);
	if (!guarded.ok) return guarded.response;
	const input: AvailabilityInput = guarded.data;
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) {
		return liveEventErrorResponse(loaded);
	}
	const res = await upsertAvailability(
		db,
		loaded.event,
		{
			name: input.name,
			password: input.password,
			slots: input.slots,
		},
		now,
	);
	if (!res.ok && res.code === "invalid_slot") {
		return jsonError(
			"invalid_slot",
			"One or more slots are outside the event",
			422,
		);
	}
	if (!res.ok) {
		return jsonError("invalid_password", "Wrong password for this name", 401);
	}
	const out: components["schemas"]["AvailabilityResponse"] = {
		count: res.result.count,
		name: res.result.name,
		protected: res.result.protected,
		updatedAt: new Date(res.result.updatedAt).toISOString(),
	};
	return Response.json(out, { headers: securityHeaders() });
}

export async function getOwnAvailabilityResponse(
	eventId: string,
	request: Request,
): Promise<Response> {
	const noStore = { noStore: true } as const;
	const name = new URL(request.url).searchParams.get("name") ?? "";
	if (!name.trim()) {
		return jsonError(
			"bad_request",
			"Query param name is required",
			400,
			undefined,
			noStore,
		);
	}
	const db = getDb();
	const now = Date.now();
	const throttled = await guardRateLimit(request, "read", RATE_LIMITS.read, {
		noStore: true,
	});
	if (throttled) return throttled;
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) {
		return liveEventErrorResponse(loaded, noStore);
	}
	const res = await getOwnAvailability(
		db,
		loaded.event,
		name,
		request.headers.get("x-event-password"),
	);
	if (!res.ok && res.code === "not_found") {
		return jsonError(
			"availability_not_found",
			"No availability for this name",
			404,
			undefined,
			noStore,
		);
	}
	if (!res.ok) {
		return jsonError(
			"invalid_password",
			"Wrong password for this name",
			401,
			undefined,
			noStore,
		);
	}
	return Response.json(
		{ name: res.name, slots: res.slots },
		{
			headers: {
				...securityHeaders(),
				"Cache-Control": "no-store",
			},
		},
	);
}

export const Route = createFileRoute("/api/events/$eventId/availability")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				getOwnAvailabilityResponse(params.eventId, request),
			POST: ({ params, request }) => saveAvailability(request, params.eventId),
			PUT: ({ params, request }) => saveAvailability(request, params.eventId),
		},
	},
});
