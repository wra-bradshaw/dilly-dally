const ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

export function generateEventId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	let id = "";
	for (const b of bytes) {
		id += ALPHABET[b % ALPHABET.length];
	}
	return id;
}

export function isValidEventId(id: string): boolean {
	return /^[A-Za-z0-9_-]{12}$/.test(id);
}
