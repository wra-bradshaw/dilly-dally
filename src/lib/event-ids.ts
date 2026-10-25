import { nanoid } from "nanoid";

export function generateEventId(): string {
	return nanoid(12);
}

export function isValidEventId(id: string): boolean {
	return /^[A-Za-z0-9_-]{12}$/.test(id);
}
