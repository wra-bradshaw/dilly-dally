const ITERATIONS = 210_000;

function toB64(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(s: string): Uint8Array {
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{
			hash: "SHA-256",
			iterations: ITERATIONS,
			name: "PBKDF2",
			salt: salt as Uint8Array<ArrayBuffer>,
		},
		key,
		256,
	);
	return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	try {
		const parts = stored.split("$");
		if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
		const iterations = Number(parts[1]);
		if (!Number.isInteger(iterations) || iterations < 1) return false;
		const salt = fromB64(parts[2]);
		const expected = fromB64(parts[3]);
		const key = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(password),
			"PBKDF2",
			false,
			["deriveBits"],
		);
		const bits = await crypto.subtle.deriveBits(
			{
				hash: "SHA-256",
				iterations,
				name: "PBKDF2",
				salt: salt as Uint8Array<ArrayBuffer>,
			},
			key,
			expected.length * 8,
		);
		const actual = new Uint8Array(bits);
		if (actual.length !== expected.length) return false;
		let diff = 0;
		for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
		return diff === 0;
	} catch {
		return false;
	}
}
