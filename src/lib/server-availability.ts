import { and, eq, isNull } from "drizzle-orm";
import {
	type DillyEvent,
	type DrizzleDb,
	getParticipantRow,
	parseSlotsJson,
} from "./db";
import { hashPassword, verifyPassword } from "./password";
import * as schema from "./schema";
import { buildEventUniverse, normalizeSlots } from "./time-slots";
import { type AvailabilityInput, nameKey } from "./validation";

export interface AvailabilityResult {
	name: string;
	count: number;
	protected: boolean;
	updatedAt: number;
}

async function applyUpdate(
	db: DrizzleDb,
	event: DillyEvent,
	existing: NonNullable<Awaited<ReturnType<typeof getParticipantRow>>>,
	input: AvailabilityInput,
	slots: string[],
	now: number,
	deps: { hash: typeof hashPassword; verify: typeof verifyPassword },
): Promise<
	| { ok: true; result: AvailabilityResult }
	| { ok: false; code: "invalid_password" }
> {
	const key = nameKey(input.name);
	const guard =
		existing.passwordHash === null
			? isNull(schema.participants.passwordHash)
			: eq(schema.participants.passwordHash, existing.passwordHash);
	const scope = and(
		eq(schema.participants.eventId, event.id),
		eq(schema.participants.nameKey, key),
		guard,
	);
	if (existing.passwordHash !== null) {
		if (!input.password) return { code: "invalid_password", ok: false };
		const valid = await deps.verify(input.password, existing.passwordHash);
		if (!valid) return { code: "invalid_password", ok: false };
		const updated = await db
			.update(schema.participants)
			.set({ slotsJson: JSON.stringify(slots), updatedAt: now })
			.where(scope)
			.returning({ nameKey: schema.participants.nameKey });
		if (updated.length === 0) return { code: "invalid_password", ok: false };
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
	const updated = await db
		.update(schema.participants)
		.set({
			passwordHash,
			slotsJson: JSON.stringify(slots),
			updatedAt: now,
		})
		.where(scope)
		.returning({ nameKey: schema.participants.nameKey });
	if (updated.length === 0) return { code: "invalid_password", ok: false };
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
	const universe = new Set(buildEventUniverse(event));
	for (const s of input.slots) {
		if (!universe.has(s)) return { code: "invalid_slot", ok: false };
	}
	const slots = normalizeSlots(input.slots);
	const key = nameKey(input.name);
	const existing = await getParticipantRow(db, event.id, key);
	if (existing) {
		return applyUpdate(db, event, existing, input, slots, now, deps);
	}
	const passwordHash = input.password ? await deps.hash(input.password) : null;
	const nameDisplay = input.name.trim();
	await db
		.insert(schema.participants)
		.values({
			eventId: event.id,
			nameDisplay,
			nameKey: key,
			passwordHash,
			slotsJson: JSON.stringify(slots),
			updatedAt: now,
		})
		.onConflictDoNothing({
			target: [schema.participants.eventId, schema.participants.nameKey],
		});
	const raced = await getParticipantRow(db, event.id, key);
	if (!raced) {
		throw new Error("Availability insert failed");
	}
	if (
		raced.nameDisplay === nameDisplay &&
		raced.slotsJson === JSON.stringify(slots) &&
		raced.passwordHash === passwordHash
	) {
		return {
			ok: true,
			result: {
				count: slots.length,
				name: nameDisplay,
				protected: passwordHash !== null,
				updatedAt: now,
			},
		};
	}
	return applyUpdate(db, event, raced, input, slots, now, deps);
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
