import { createFileRoute } from "@tanstack/react-router";
import { clientIp, jsonError, rateLimited, zodFields } from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { deleteEvent, fetchEvent } from "#/lib/db";
import { getDb } from "#/lib/db-env";
import { isValidEventId } from "#/lib/event-ids";
import { isExpired } from "#/lib/expiry";
import { RATE_LIMITS, rateLimitKey } from "#/lib/rate-limit";
import {
	getOwnAvailability,
	upsertAvailability,
} from "#/lib/server-availability";
import { checkRateLimitDb } from "#/lib/server-rate-limit";
import { type AvailabilityInput, availabilitySchema } from "#/lib/validation";

async function loadEvent(eventId: string) {
	const db = getDb();
	if (!isValidEventId(eventId)) return null;
	const event = await fetchEvent(db, eventId);
	if (!event) return null;
	if (isExpired(event.expiresAt, Date.now())) {
		await deleteEvent(db, event.id);
		return null;
	}
	return { db, event };
}

async function saveAvailability(request: Request, eventId: string) {
	let raw: unknown;
	try {
		raw =
			(await request.json()) as components["schemas"]["AvailabilityRequest"];
	} catch {
		return jsonError("bad_request", "Invalid JSON", 400);
	}
	const parsed = availabilitySchema.safeParse(raw);
	if (!parsed.success) {
		return jsonError(
			"bad_request",
			"Validation failed",
			400,
			zodFields(parsed.error),
		);
	}
	const input: AvailabilityInput = parsed.data;
	const loaded = await loadEvent(eventId);
	if (!loaded) return jsonError("not_found", "Event not found", 404);
	const { db, event } = loaded;
	const key = await rateLimitKey(clientIp(request), "availability_write");
	const rl = await checkRateLimitDb(
		db,
		key,
		Date.now(),
		RATE_LIMITS.availabilityWrite.windowMs,
		RATE_LIMITS.availabilityWrite.limit,
	);
	if (!rl.allowed) return rateLimited(rl.resetMs);
	const res = await upsertAvailability(
		db,
		event,
		{
			name: input.name,
			password: input.password,
			slots: input.slots,
		},
		Date.now(),
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
	return Response.json(out);
}

export const Route = createFileRoute("/api/events/$eventId/availability")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const name = new URL(request.url).searchParams.get("name") ?? "";
				if (!name.trim()) {
					return jsonError("bad_request", "Query param name is required", 400);
				}
				const loaded = await loadEvent(params.eventId);
				if (!loaded) return jsonError("not_found", "Event not found", 404);
				const { db, event } = loaded;
				const key = await rateLimitKey(clientIp(request), "read");
				const rl = await checkRateLimitDb(
					db,
					key,
					Date.now(),
					RATE_LIMITS.read.windowMs,
					RATE_LIMITS.read.limit,
				);
				if (!rl.allowed) return rateLimited(rl.resetMs);
				const res = await getOwnAvailability(
					db,
					event,
					name,
					request.headers.get("x-event-password"),
				);
				if (!res.ok && res.code === "not_found") {
					return jsonError("not_found", "No availability for this name", 404);
				}
				if (!res.ok) {
					return jsonError(
						"invalid_password",
						"Wrong password for this name",
						401,
					);
				}
				return Response.json(res, {
					headers: { "Cache-Control": "no-store" },
				});
			},
			POST: ({ params, request }) => saveAvailability(request, params.eventId),
			PUT: ({ params, request }) => saveAvailability(request, params.eventId),
		},
	},
});
