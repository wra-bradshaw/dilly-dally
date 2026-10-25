import { and, eq, isNull } from "drizzle-orm";
import { type DrizzleDb, getParticipantRow } from "./db";
import type { hashPassword, verifyPassword } from "./password";
import * as schema from "./schema";

export interface ParticipantAuthDeps {
	hash: typeof hashPassword;
	verify: typeof verifyPassword;
}

export type ParticipantRow = NonNullable<
	Awaited<ReturnType<typeof getParticipantRow>>
>;

export async function verifyProtectedAccess(
	inputPassword: string | null | undefined,
	storedHash: string,
	deps: Pick<ParticipantAuthDeps, "verify">,
	sessionAuthenticated: boolean,
): Promise<{ ok: true } | { code: "invalid_password"; ok: false }> {
	if (sessionAuthenticated) return { ok: true };
	if (!inputPassword) return { code: "invalid_password", ok: false };
	const valid = await deps.verify(inputPassword, storedHash);
	if (!valid) return { code: "invalid_password", ok: false };
	return { ok: true };
}

async function insertParticipantRace(
	db: DrizzleDb,
	eventId: string,
	values: {
		nameDisplay: string;
		nameKey: string;
		passwordHash: string | null;
		slotsJson: string;
		updatedAt: number;
	},
): Promise<{ row: ParticipantRow; won: boolean }> {
	await db
		.insert(schema.participants)
		.values({
			eventId,
			nameDisplay: values.nameDisplay,
			nameKey: values.nameKey,
			passwordHash: values.passwordHash,
			slotsJson: values.slotsJson,
			updatedAt: values.updatedAt,
		})
		.onConflictDoNothing({
			target: [schema.participants.eventId, schema.participants.nameKey],
		});
	const raced = await getParticipantRow(db, eventId, values.nameKey);
	if (!raced) throw new Error("Participant insert failed");
	const won =
		raced.nameDisplay === values.nameDisplay &&
		raced.slotsJson === values.slotsJson &&
		raced.passwordHash === values.passwordHash;
	return { row: raced, won };
}

export async function ensureParticipantInsert(
	db: DrizzleDb,
	eventId: string,
	nameDisplay: string,
	key: string,
	inputPassword: string | null | undefined,
	opts: {
		deps: ParticipantAuthDeps;
		now: number;
		sessionAuthenticated: boolean;
		slotsJson: string;
	},
): Promise<
	| {
			candidateHash: string | null;
			ok: true;
			row: ParticipantRow;
			wonInsert: boolean;
	  }
	| { code: "invalid_password"; ok: false }
> {
	if (opts.sessionAuthenticated) {
		const { row, won } = await insertParticipantRace(db, eventId, {
			nameDisplay,
			nameKey: key,
			passwordHash: null,
			slotsJson: opts.slotsJson,
			updatedAt: opts.now,
		});
		return { candidateHash: null, ok: true, row, wonInsert: won };
	}
	const candidateHash = inputPassword
		? await opts.deps.hash(inputPassword)
		: null;
	const { row, won } = await insertParticipantRace(db, eventId, {
		nameDisplay,
		nameKey: key,
		passwordHash: candidateHash,
		slotsJson: opts.slotsJson,
		updatedAt: opts.now,
	});
	if (won) return { candidateHash, ok: true, row, wonInsert: true };
	if (row.passwordHash) {
		const checked = await verifyProtectedAccess(
			inputPassword,
			row.passwordHash,
			opts.deps,
			false,
		);
		if (!checked.ok) return checked;
		return { candidateHash, ok: true, row, wonInsert: false };
	}
	return { candidateHash, ok: true, row, wonInsert: false };
}

export async function claimUnprotectedParticipant(
	db: DrizzleDb,
	eventId: string,
	key: string,
	passwordHash: string | null,
	now: number,
	slotsJson?: string,
): Promise<{ ok: true } | { code: "invalid_password"; ok: false }> {
	const updated = await db
		.update(schema.participants)
		.set(
			slotsJson === undefined
				? { passwordHash, updatedAt: now }
				: { passwordHash, slotsJson, updatedAt: now },
		)
		.where(
			and(
				eq(schema.participants.eventId, eventId),
				eq(schema.participants.nameKey, key),
				isNull(schema.participants.passwordHash),
			),
		)
		.returning({ nameKey: schema.participants.nameKey });
	if (updated.length === 0) return { code: "invalid_password", ok: false };
	return { ok: true };
}
