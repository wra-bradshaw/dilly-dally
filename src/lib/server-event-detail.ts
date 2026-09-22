import { HttpError } from "./client";
import { type DrizzleDb, deleteEvent, fetchEvent } from "./db";
import { isValidEventId } from "./event-ids";
import { isExpired } from "./expiry";
import { getEventDetail } from "./server-availability";

export async function loadEventDetailFromDb(
	db: DrizzleDb,
	eventId: string,
	now: number,
) {
	if (!isValidEventId(eventId)) {
		throw new HttpError(404, "not_found", "Event not found");
	}
	const event = await fetchEvent(db, eventId);
	if (!event) {
		throw new HttpError(404, "not_found", "Event not found");
	}
	if (isExpired(event.expiresAt, now)) {
		await deleteEvent(db, event.id);
		throw new HttpError(410, "gone", "Event has expired");
	}
	return getEventDetail(db, event);
}
