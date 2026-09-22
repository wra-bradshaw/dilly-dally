import { and, eq, lt, lte } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DrizzleDb = DrizzleD1Database<typeof schema>;

export interface DillyEvent {
	id: string;
	title: string;
	dates: string[];
	startTime: string;
	endTime: string;
	timezone: string;
	createdAt: number;
	expiresAt: number;
}

export interface ParticipantInfo {
	name: string;
	slots: string[];
	updatedAt: number;
	hasPassword: boolean;
}

export function parseSlotsJson(json: string): string[] {
	try {
		const v = JSON.parse(json) as unknown;
		if (!Array.isArray(v)) return [];
		return v.filter((s): s is string => typeof s === "string");
	} catch {
		return [];
	}
}

export function toPublicEvent(
	row: typeof schema.events.$inferSelect,
): DillyEvent | null {
	try {
		const dates = JSON.parse(row.datesJson) as unknown;
		if (!Array.isArray(dates) || !dates.every((d) => typeof d === "string"))
			return null;
		return {
			createdAt: row.createdAt,
			dates,
			endTime: row.endTime,
			expiresAt: row.expiresAt,
			id: row.id,
			startTime: row.startTime,
			timezone: row.timezone,
			title: row.title,
		};
	} catch {
		return null;
	}
}

export async function fetchEvent(
	db: DrizzleDb,
	id: string,
): Promise<DillyEvent | null> {
	const rows = await db
		.select()
		.from(schema.events)
		.where(eq(schema.events.id, id));
	const row = rows[0];
	if (!row) return null;
	return toPublicEvent(row);
}

export async function insertEvent(
	db: DrizzleDb,
	event: DillyEvent,
): Promise<void> {
	await db.insert(schema.events).values({
		createdAt: event.createdAt,
		datesJson: JSON.stringify(event.dates),
		endTime: event.endTime,
		expiresAt: event.expiresAt,
		id: event.id,
		startTime: event.startTime,
		timezone: event.timezone,
		title: event.title,
	});
}

export async function deleteEvent(db: DrizzleDb, id: string): Promise<void> {
	await db
		.delete(schema.participants)
		.where(eq(schema.participants.eventId, id));
	await db.delete(schema.events).where(eq(schema.events.id, id));
}

export async function purgeExpired(
	db: DrizzleDb,
	now: number,
): Promise<number> {
	const expired = await db
		.select({ id: schema.events.id })
		.from(schema.events)
		.where(lte(schema.events.expiresAt, now));
	for (const r of expired) {
		await db
			.delete(schema.participants)
			.where(eq(schema.participants.eventId, r.id));
		await db.delete(schema.events).where(eq(schema.events.id, r.id));
	}
	await db
		.delete(schema.rateCounters)
		.where(lt(schema.rateCounters.windowStart, now - 2 * 3_600_000));
	return expired.length;
}

export async function listParticipants(
	db: DrizzleDb,
	eventId: string,
): Promise<ParticipantInfo[]> {
	const rows = await db
		.select()
		.from(schema.participants)
		.where(eq(schema.participants.eventId, eventId));
	return rows.map((r) => ({
		hasPassword: r.passwordHash !== null,
		name: r.nameDisplay,
		slots: parseSlotsJson(r.slotsJson),
		updatedAt: r.updatedAt,
	}));
}

export async function getParticipantRow(
	db: DrizzleDb,
	eventId: string,
	nameKey: string,
): Promise<typeof schema.participants.$inferSelect | null> {
	const rows = await db
		.select()
		.from(schema.participants)
		.where(
			and(
				eq(schema.participants.eventId, eventId),
				eq(schema.participants.nameKey, nameKey),
			),
		);
	return rows[0] ?? null;
}
