import { and, eq, isNull } from "drizzle-orm";
import {
	type DillyEvent,
	type DrizzleDb,
	getParticipantRow,
	parseSlotsJson,
} from "./db";
import { hashPassword, verifyPassword } from "./password";
import * as schema from "./schema";
import {
	claimUnprotectedParticipant,
	ensureParticipantInsert,
	verifyProtectedAccess,
} from "./server-participant-auth";
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
	sessionAuthenticated = false,
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
		const checked = await verifyProtectedAccess(
			input.password,
			existing.passwordHash,
			deps,
			sessionAuthenticated,
		);
		if (!checked.ok) return checked;
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
	const passwordHash =
		sessionAuthenticated || !input.password
			? null
			: await deps.hash(input.password);
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
	opts: { sessionNameKey?: string } = {},
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
	const sessionAuthenticated =
		opts.sessionNameKey !== undefined && opts.sessionNameKey === key;
	const existing = await getParticipantRow(db, event.id, key);
	if (existing) {
		if (sessionAuthenticated) {
			return applyUpdate(db, event, existing, input, slots, now, deps, true);
		}
		return applyUpdate(db, event, existing, input, slots, now, deps);
	}
	const nameDisplay = input.name.trim();
	const ensured = await ensureParticipantInsert(
		db,
		event.id,
		nameDisplay,
		key,
		input.password ?? null,
		{
			deps,
			now,
			sessionAuthenticated,
			slotsJson: JSON.stringify(slots),
		},
	);
	if (!ensured.ok) return ensured;
	if (ensured.wonInsert) {
		return {
			ok: true,
			result: {
				count: slots.length,
				name: nameDisplay,
				protected: ensured.candidateHash !== null,
				updatedAt: now,
			},
		};
	}
	if (ensured.row.passwordHash) {
		const updated = await db
			.update(schema.participants)
			.set({ slotsJson: JSON.stringify(slots), updatedAt: now })
			.where(
				and(
					eq(schema.participants.eventId, event.id),
					eq(schema.participants.nameKey, key),
					eq(schema.participants.passwordHash, ensured.row.passwordHash),
				),
			)
			.returning({ nameKey: schema.participants.nameKey });
		if (updated.length === 0) return { code: "invalid_password", ok: false };
		return {
			ok: true,
			result: {
				count: slots.length,
				name: ensured.row.nameDisplay,
				protected: true,
				updatedAt: now,
			},
		};
	}
	const claimed = await claimUnprotectedParticipant(
		db,
		event.id,
		key,
		ensured.candidateHash,
		now,
		JSON.stringify(slots),
	);
	if (!claimed.ok) return claimed;
	return {
		ok: true,
		result: {
			count: slots.length,
			name: ensured.row.nameDisplay,
			protected: ensured.candidateHash !== null,
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
	opts: { sessionNameKey?: string } = {},
): Promise<
	| { ok: true; slots: string[]; name: string }
	| { ok: false; code: "not_found" | "invalid_password" }
> {
	const key = nameKey(name);
	const existing = await getParticipantRow(db, event.id, key);
	if (!existing) return { code: "not_found", ok: false };
	if (opts.sessionNameKey !== undefined && opts.sessionNameKey === key) {
		return {
			name: existing.nameDisplay,
			ok: true,
			slots: parseSlotsJson(existing.slotsJson),
		};
	}
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
