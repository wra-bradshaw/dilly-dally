import { createFileRoute } from "@tanstack/react-router";
import {
	clientIp,
	contentLengthTooLarge,
	isJsonContentType,
	jsonError,
	rateLimited,
	readCappedJson,
	securityHeaders,
	zodFields,
} from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { getDb } from "#/lib/db-env";
import { RATE_LIMITS, rateLimitKey } from "#/lib/rate-limit";
import {
	getOwnAvailability,
	upsertAvailability,
} from "#/lib/server-availability";
import { loadLiveEvent } from "#/lib/server-event-detail";
import { checkRateLimit } from "#/lib/server-rate-limit";
import { type AvailabilityInput, availabilitySchema } from "#/lib/validation";

export async function saveAvailability(
	request: Request,
	eventId: string,
): Promise<Response> {
	const db = getDb();
	const now = Date.now();
	const key = await rateLimitKey(clientIp(request), "availability_write");
	const rl = await checkRateLimit(
		key,
		now,
		RATE_LIMITS.availabilityWrite.windowMs,
		RATE_LIMITS.availabilityWrite.limit,
	);
	if (!rl.allowed) return rateLimited(rl.resetMs);
	if (contentLengthTooLarge(request))
		return jsonError("bad_request", "Payload too large", 413);
	if (!isJsonContentType(request))
		return jsonError(
			"bad_request",
			"Content-Type must be application/json",
			415,
		);
	const body = await readCappedJson(request);
	if (!body.ok) {
		return body.reason === "too_large"
			? jsonError("bad_request", "Payload too large", 413)
			: jsonError("bad_request", "Invalid JSON", 400);
	}
	const parsed = availabilitySchema.safeParse(body.value);
	if (!parsed.success) {
		return jsonError(
			"bad_request",
			"Validation failed",
			400,
			zodFields(parsed.error),
		);
	}
	const input: AvailabilityInput = parsed.data;
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) {
		return jsonError(
			loaded.code,
			loaded.code === "gone" ? "Event has expired" : "Event not found",
			loaded.status,
		);
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
		return jsonError("bad_request", "Query param name is required", 400, undefined, noStore);
	}
	const db = getDb();
	const now = Date.now();
	const key = await rateLimitKey(clientIp(request), "read");
	const rl = await checkRateLimit(
		key,
		now,
		RATE_LIMITS.read.windowMs,
		RATE_LIMITS.read.limit,
	);
	if (!rl.allowed) return rateLimited(rl.resetMs);
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) {
		return jsonError(
			loaded.code,
			loaded.code === "gone" ? "Event has expired" : "Event not found",
			loaded.status,
			undefined,
			noStore,
		);
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
