import {
	type DillyEvent,
	type DrizzleDb,
	deleteEvent,
	fetchEvent,
	listParticipants,
} from "./db";
import { isValidEventId } from "./event-ids";
import { isExpired } from "./expiry";
import { HttpError } from "./http-error";
import { toEventDto } from "./server-events";
import { buildEventUniverse, computeCounts, findBestTimes } from "./time-slots";

type LiveEventResult =
	| { event: DillyEvent; ok: true }
	| { code: "not_found" | "gone"; ok: false; status: 404 | 410 };

export async function loadLiveEvent(
	db: DrizzleDb,
	eventId: string,
	now: number,
): Promise<LiveEventResult> {
	if (!isValidEventId(eventId)) {
		return { code: "not_found", ok: false, status: 404 };
	}
	const event = await fetchEvent(db, eventId);
	if (!event) {
		return { code: "not_found", ok: false, status: 404 };
	}
	if (isExpired(event.expiresAt, now)) {
		await deleteEvent(db, event.id);
		return { code: "gone", ok: false, status: 410 };
	}
	return { event, ok: true };
}

export async function getEventDetail(db: DrizzleDb, event: DillyEvent) {
	const universe = buildEventUniverse(event);
	const parts = await listParticipants(db, event.id);
	const counts = computeCounts(
		universe,
		parts.map((p) => ({ name: p.name, slots: p.slots })),
	);
	return {
		bestTimes: findBestTimes(counts, 10).map((c) => ({
			count: c.count,
			slot: c.slot,
		})),
		counts,
		event: toEventDto(event),
		participants: parts.map((p) => ({
			count: p.slots.length,
			name: p.name,
			updatedAt: new Date(p.updatedAt).toISOString(),
		})),
		slotUniverse: universe,
	};
}

export async function loadEventDetailFromDb(
	db: DrizzleDb,
	eventId: string,
	now: number,
) {
	const loaded = await loadLiveEvent(db, eventId, now);
	if (!loaded.ok) {
		throw new HttpError(
			loaded.status,
			loaded.code,
			loaded.code === "gone" ? "Event has expired" : "Event not found",
		);
	}
	return getEventDetail(db, loaded.event);
}
