import { and, eq } from "drizzle-orm";
import {
	type DillyEvent,
	type DrizzleDb,
	getParticipantRow,
	listParticipants,
	parseSlotsJson,
} from "./db";
import { hashPassword, verifyPassword } from "./password";
import * as schema from "./schema";
import {
	buildSlotUniverse,
	computeCounts,
	findBestTimes,
	normalizeSlots,
} from "./time-slots";
import { nameKey } from "./validation";

export interface AvailabilityInput {
	name: string;
	password?: string;
	slots: string[];
}

export interface AvailabilityResult {
	name: string;
	count: number;
	protected: boolean;
	updatedAt: number;
}

export async function upsertAvailability(
	db: DrizzleDb,
	event: DillyEvent,
	input: AvailabilityInput,
	now: number,
	deps: {
		hash: typeof hashPassword;
		verify: typeof verifyPassword;
	} = { hash: hashPassword, verify: verifyPassword },
): Promise<
	| { ok: true; result: AvailabilityResult }
	| { ok: false; code: "invalid_password" | "invalid_slot" }
> {
	const universe = new Set(
		buildSlotUniverse({
			dates: event.dates,
			endTime: event.endTime,
			startTime: event.startTime,
		}),
	);
	for (const s of input.slots) {
		if (!universe.has(s)) return { code: "invalid_slot", ok: false };
	}
	const slots = normalizeSlots(input.slots);
	const key = nameKey(input.name);
	const existing = await getParticipantRow(db, event.id, key);
	if (!existing) {
		const passwordHash = input.password
			? await deps.hash(input.password)
			: null;
		await db.insert(schema.participants).values({
			eventId: event.id,
			nameDisplay: input.name.trim(),
			nameKey: key,
			passwordHash,
			slotsJson: JSON.stringify(slots),
			updatedAt: now,
		});
		return {
			ok: true,
			result: {
				count: slots.length,
				name: input.name.trim(),
				protected: passwordHash !== null,
				updatedAt: now,
			},
		};
	}
	if (existing.passwordHash !== null) {
		if (!input.password) return { code: "invalid_password", ok: false };
		const valid = await deps.verify(input.password, existing.passwordHash);
		if (!valid) return { code: "invalid_password", ok: false };
		await db
			.update(schema.participants)
			.set({ slotsJson: JSON.stringify(slots), updatedAt: now })
			.where(
				and(
					eq(schema.participants.eventId, event.id),
					eq(schema.participants.nameKey, key),
				),
			);
		return {
			ok: true,
			result: {
				count: slots.length,
				name: existing.nameDisplay,
				protected: true,
				updatedAt: now,
			},
		};
	}
	const passwordHash = input.password ? await deps.hash(input.password) : null;
	await db
		.update(schema.participants)
		.set({
			passwordHash,
			slotsJson: JSON.stringify(slots),
			updatedAt: now,
		})
		.where(
			and(
				eq(schema.participants.eventId, event.id),
				eq(schema.participants.nameKey, key),
			),
		);
	return {
		ok: true,
		result: {
			count: slots.length,
			name: existing.nameDisplay,
			protected: passwordHash !== null,
			updatedAt: now,
		},
	};
}

export async function getOwnAvailability(
	db: DrizzleDb,
	event: DillyEvent,
	name: string,
	password: string | null,
	deps: { verify: typeof verifyPassword } = { verify: verifyPassword },
): Promise<
	| { ok: true; slots: string[]; name: string }
	| { ok: false; code: "not_found" | "invalid_password" }
> {
	const key = nameKey(name);
	const existing = await getParticipantRow(db, event.id, key);
	if (!existing) return { code: "not_found", ok: false };
	if (existing.passwordHash !== null) {
		if (!password) return { code: "invalid_password", ok: false };
		const valid = await deps.verify(password, existing.passwordHash);
		if (!valid) return { code: "invalid_password", ok: false };
	}
	return {
		name: existing.nameDisplay,
		ok: true,
		slots: parseSlotsJson(existing.slotsJson),
	};
}

export async function getEventDetail(db: DrizzleDb, event: DillyEvent) {
	const universe = buildSlotUniverse({
		dates: event.dates,
		endTime: event.endTime,
		startTime: event.startTime,
	});
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
		event: {
			createdAt: new Date(event.createdAt).toISOString(),
			dates: event.dates,
			endTime: event.endTime,
			expiresAt: new Date(event.expiresAt).toISOString(),
			id: event.id,
			startTime: event.startTime,
			timezone: event.timezone,
			title: event.title,
		},
		participants: parts.map((p) => ({
			count: p.slots.length,
			name: p.name,
			updatedAt: new Date(p.updatedAt).toISOString(),
		})),
		slotUniverse: universe,
	};
}
