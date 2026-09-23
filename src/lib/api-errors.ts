import type { ZodError } from "zod";

export function jsonError(
	code: string,
	message: string,
	status: number,
	fields?: Record<string, string[]>,
	opts?: { noStore?: boolean },
): Response {
	const headers: Record<string, string> = {
		...securityHeaders(),
		"Content-Type": "application/json",
	};
	if (opts?.noStore) headers["Cache-Control"] = "no-store";
	return Response.json(
		{ error: { code, fields, message } },
		{ headers, status },
	);
}

export function securityHeaders(): Record<string, string> {
	return {
		"Referrer-Policy": "strict-origin-when-cross-origin",
		"X-Content-Type-Options": "nosniff",
	};
}

export function rateLimited(resetMs: number): Response {
	const retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
	return new Response(
		JSON.stringify({
			error: { code: "rate_limited", message: "Too many requests" },
		}),
		{
			headers: {
				...securityHeaders(),
				"Content-Type": "application/json",
				"Retry-After": String(retryAfter),
			},
			status: 429,
		},
	);
}

export function zodFields(error: ZodError): Record<string, string[]> {
	const out: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const key = issue.path.join(".") || "_";
		const list = out[key];
		if (list) list.push(issue.message);
		else out[key] = [issue.message];
	}
	return out;
}

export function clientIp(request: Request): string {
	const cf = request.headers.get("cf-connecting-ip");
	if (cf) return cf;
	const xff = request.headers.get("x-forwarded-for");
	if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
	return "unknown";
}

export function originOf(request: Request): string {
	return new URL(request.url).origin;
}

const MAX_JSON_BYTES = 262_144;

export function contentLengthTooLarge(request: Request): boolean {
	const raw = request.headers.get("content-length");
	if (!raw) return false;
	const n = Number(raw);
	return Number.isFinite(n) && n > MAX_JSON_BYTES;
}

export function isJsonContentType(request: Request): boolean {
	const ct = request.headers.get("content-type") ?? "";
	return ct.split(";")[0]?.trim().toLowerCase() === "application/json";
}

export async function readCappedJson(
	request: Request,
	maxBytes: number = MAX_JSON_BYTES,
): Promise<
	{ ok: true; value: unknown } | { ok: false; reason: "too_large" | "invalid" }
> {
	if (!request.body) {
		const raw = request.headers.get("content-length");
		if (raw !== null) {
			const n = Number(raw);
			if (Number.isFinite(n) && n > maxBytes) {
				return { ok: false, reason: "too_large" };
			}
		}
		try {
			return { ok: true, value: await request.json() };
		} catch {
			return { ok: false, reason: "invalid" };
		}
	}
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => {});
			return { ok: false, reason: "too_large" };
		}
		chunks.push(value);
	}
	const merged = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return {
			ok: true,
			value: JSON.parse(new TextDecoder().decode(merged)) as unknown,
		};
	} catch {
		return { ok: false, reason: "invalid" };
	}
}
