import type { components } from "./api-schema";
import {
	type DillyEvent,
	type DrizzleDb,
	fetchEvent,
	insertEvent,
} from "./db";
import { generateEventId, isValidEventId } from "./event-ids";
import { computeExpiry } from "./expiry";
import type { CreateEventInput } from "./validation";

export function toEventDto(
	event: DillyEvent,
): components["schemas"]["Event"] {
	return {
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
}

function isIdCollision(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err);
	return (
		/unique constraint failed/i.test(msg) ||
		/primary key/i.test(msg) ||
		/duplicate key/i.test(msg) ||
		/already exists/i.test(msg)
	);
}

export async function createEventInDb(
	db: DrizzleDb,
	input: CreateEventInput,
	now: number,
): Promise<DillyEvent | null> {
	const mode = input.mode ?? "dates";
	const dates = mode === "weekly" ? [] : [...(input.dates ?? [])].sort();
	const weekdays =
		mode === "weekly"
			? [...new Set(input.weekdays ?? [])].sort((a, b) => a - b)
			: [];
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
			if (!isIdCollision(err)) return null;
			id = generateEventId();
		}
	}
	if (!inserted) return null;
	return fetchEvent(db, id);
}
