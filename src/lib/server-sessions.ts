import { eq } from "drizzle-orm";
import { type DillyEvent, type DrizzleDb, getParticipantRow } from "./db";
import { DAY_MS } from "./expiry";
import { verifyPassword } from "./password";
import * as schema from "./schema";
import { nameKey } from "./validation";

export const SESSION_TTL_MS = 30 * DAY_MS;
const SESSION_TOKEN_BYTES = 32;

function generateSessionToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES));
	return Buffer.from(bytes).toString("base64url");
}

async function hashSessionToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return Buffer.from(digest).toString("hex");
}

export async function createEventSession(
	db: DrizzleDb,
	event: DillyEvent,
	name: string,
	password: string | null,
	now: number,
	deps: { verify: typeof verifyPassword } = { verify: verifyPassword },
): Promise<
	| { name: string; ok: true; token: string }
	| { ok: false; code: "invalid_password" | "bad_request" }
> {
	const key = nameKey(name.trim());
	if (!key) return { code: "bad_request", ok: false };
	const existing = await getParticipantRow(db, event.id, key);
	if (existing?.passwordHash) {
		if (!password) return { code: "invalid_password", ok: false };
		const valid = await deps.verify(password, existing.passwordHash);
		if (!valid) return { code: "invalid_password", ok: false };
	}
	const token = generateSessionToken();
	const tokenHash = await hashSessionToken(token);
	const nameDisplay = existing?.nameDisplay ?? name.trim();
	await db.insert(schema.eventSessions).values({
		createdAt: now,
		eventId: event.id,
		expiresAt: now + SESSION_TTL_MS,
		nameDisplay,
		nameKey: key,
		passwordHash: existing?.passwordHash ?? null,
		tokenHash,
	});
	return { name: nameDisplay, ok: true, token };
}

export async function resolveEventSession(
	db: DrizzleDb,
	token: string,
	now: number,
): Promise<
	| { eventId: string; name: string; nameKey: string; ok: true }
	| { code: "expired" | "mismatch" | "not_found"; ok: false }
> {
	let tokenHash: string;
	try {
		tokenHash = await hashSessionToken(token);
	} catch {
		return { code: "not_found", ok: false };
	}
	const rows = await db
		.select()
		.from(schema.eventSessions)
		.where(eq(schema.eventSessions.tokenHash, tokenHash));
	const row = rows[0];
	if (!row) return { code: "not_found", ok: false };
	if (row.expiresAt <= now) {
		await db
			.delete(schema.eventSessions)
			.where(eq(schema.eventSessions.tokenHash, tokenHash));
		return { code: "expired", ok: false };
	}
	const participant = await getParticipantRow(db, row.eventId, row.nameKey);
	const current = participant?.passwordHash ?? null;
	if ((row.passwordHash ?? null) !== current) {
		await db
			.delete(schema.eventSessions)
			.where(eq(schema.eventSessions.tokenHash, tokenHash));
		return { code: "mismatch", ok: false };
	}
	return {
		eventId: row.eventId,
		name: row.nameDisplay,
		nameKey: row.nameKey,
		ok: true,
	};
}

export async function revokeEventSession(
	db: DrizzleDb,
	token: string,
): Promise<void> {
	try {
		const tokenHash = await hashSessionToken(token);
		await db
			.delete(schema.eventSessions)
			.where(eq(schema.eventSessions.tokenHash, tokenHash));
	} catch {
		return;
	}
}
