import { parseCookie, stringifySetCookie } from "cookie";
import { isValidEventId } from "./event-ids";

export function sessionCookieName(eventId: string): string | null {
	if (!isValidEventId(eventId)) return null;
	return `dd_s_${eventId}`;
}

export function parseSessionCookie(
	cookieHeader: string | null,
	eventId: string,
): string | null {
	const name = sessionCookieName(eventId);
	if (!name || !cookieHeader) return null;
	const parsed = parseCookie(cookieHeader);
	const value = parsed[name];
	if (!value) return null;
	if (!/^[\w-]{20,128}$/.test(value)) return null;
	return value;
}

export function buildSessionCookie(
	eventId: string,
	token: string,
	secure: boolean,
	maxAgeSeconds = 30 * 24 * 60 * 60,
): string {
	const name = sessionCookieName(eventId);
	return stringifySetCookie({
		httpOnly: true,
		maxAge: maxAgeSeconds,
		name: name ?? "",
		path: "/",
		sameSite: "lax",
		secure,
		value: token,
	});
}

export function clearSessionCookie(eventId: string, secure: boolean): string {
	const name = sessionCookieName(eventId);
	return stringifySetCookie({
		httpOnly: true,
		maxAge: 0,
		name: name ?? "",
		path: "/",
		sameSite: "lax",
		secure,
		value: "",
	});
}

export function isSecureRequest(request: Request): boolean {
	try {
		return new URL(request.url).protocol === "https:";
	} catch {
		return false;
	}
}
