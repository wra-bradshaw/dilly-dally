const ITERATIONS = 210_000;

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
	return `pbkdf2$${ITERATIONS}$${Buffer.from(salt).toString("base64url")}$${Buffer.from(bits).toString("base64url")}`;
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
		const salt = Buffer.from(parts[2], "base64url");
		const expected = Buffer.from(parts[3], "base64url");
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
