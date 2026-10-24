import type { DrizzleDb } from "./db";
import { parseSessionCookie } from "./event-cookies";
import { resolveEventSession } from "./server-sessions";
import { nameKey } from "./validation";

export async function authorizeRequestForName(
	db: DrizzleDb,
	eventId: string,
	cookieHeader: string | null,
	name: string,
	now: number,
): Promise<
	| { name: string; nameKey: string; ok: true }
	| { code: "expired" | "mismatch" | "none" | "not_found"; ok: false }
> {
	const token = parseSessionCookie(cookieHeader, eventId);
	if (!token) return { code: "none", ok: false };
	const resolved = await resolveEventSession(db, token, now);
	if (!resolved.ok) return resolved;
	if (resolved.eventId !== eventId) return { code: "mismatch", ok: false };
	if (resolved.nameKey !== nameKey(name.trim()))
		return { code: "mismatch", ok: false };
	return { name: resolved.name, nameKey: resolved.nameKey, ok: true };
}
