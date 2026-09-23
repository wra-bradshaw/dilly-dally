import { createFileRoute } from "@tanstack/react-router";
import {
	clientIp,
	jsonError,
	originOf,
	rateLimited,
	zodFields,
} from "#/lib/api-errors";
import type { components } from "#/lib/api-schema";
import { fetchEvent, insertEvent, purgeExpired } from "#/lib/db";
import { getDb } from "#/lib/db-env";
import { generateEventId, isValidEventId } from "#/lib/event-ids";
import { computeExpiry } from "#/lib/expiry";
import { RATE_LIMITS, rateLimitKey } from "#/lib/rate-limit";
import { checkRateLimitDb } from "#/lib/server-rate-limit";
import { type CreateEventInput, createEventSchema } from "#/lib/validation";

function isIdCollision(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return (
		/unique constraint failed/i.test(msg) ||
		/primary key/i.test(msg) ||
		/duplicate key/i.test(msg) ||
		/already exists/i.test(msg)
	);
}

export const Route = createFileRoute("/api/events/")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				let raw: unknown;
				try {
					raw =
						(await request.json()) as components["schemas"]["CreateEventRequest"];
				} catch {
					return jsonError("bad_request", "Invalid JSON", 400);
				}
				const parsed = createEventSchema.safeParse(raw);
				if (!parsed.success) {
					return jsonError(
						"bad_request",
						"Validation failed",
						400,
						zodFields(parsed.error),
					);
				}
				const input: CreateEventInput = parsed.data;
				const mode = input.mode ?? "dates";
				const dates = mode === "weekly" ? [] : [...(input.dates ?? [])].sort();
				const weekdays =
					mode === "weekly"
						? [...new Set(input.weekdays ?? [])].sort((a, b) => a - b)
						: [];
				const db = getDb();
				const now = Date.now();
				const key = await rateLimitKey(clientIp(request), "create_event");
				const rl = await checkRateLimitDb(
					db,
					key,
					now,
					RATE_LIMITS.createEvent.windowMs,
					RATE_LIMITS.createEvent.limit,
				);
				if (!rl.allowed) return rateLimited(rl.resetMs);
				await purgeExpired(db, now);
				let id = generateEventId();
				let inserted = false;
				for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
					if (!isValidEventId(id)) id = generateEventId();
					try {
						await insertEvent(db, {
							createdAt: now,
							dates,
							endTime: input.endTime,
							expiresAt: computeExpiry({
								createdAt: now,
								dates,
								mode,
								weekdays,
							}),
							id,
							mode,
							startTime: input.startTime,
							timezone: input.timezone,
							title: input.title,
							weekdays,
						});
						inserted = true;
					} catch (err) {
						if (!isIdCollision(err)) {
							return jsonError("internal", "Could not create event", 500);
						}
						id = generateEventId();
					}
				}
				if (!inserted)
					return jsonError("internal", "Could not create event", 500);
				const event = await fetchEvent(db, id);
				if (!event) return jsonError("internal", "Could not create event", 500);
				const origin = originOf(request);
				const dto: components["schemas"]["Event"] = {
					createdAt: new Date(event.createdAt).toISOString(),
					dates: event.dates,
					endTime: event.endTime,
					expiresAt: new Date(event.expiresAt).toISOString(),
					id: event.id,
					mode: event.mode ?? "dates",
					startTime: event.startTime,
					timezone: event.timezone,
					title: event.title,
					weekdays: event.weekdays ?? [],
				};
				const res: components["schemas"]["CreateEventResponse"] = {
					event: dto,
					id,
					url: `${origin}/e/${id}`,
				};
				return Response.json(res, { status: 201 });
			},
		},
	},
});
