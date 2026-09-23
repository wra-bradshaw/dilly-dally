import { HttpError } from "./client";
import { type DillyEvent, type DrizzleDb, deleteEvent, fetchEvent } from "./db";
import { isValidEventId } from "./event-ids";
import { isExpired } from "./expiry";
import { getEventDetail } from "./server-availability";

export type LiveEventResult =
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
