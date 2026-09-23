import type { ZodError } from "zod";

export function jsonError(
	code: string,
	message: string,
	status: number,
	fields?: Record<string, string[]>,
): Response {
	return Response.json({ error: { code, fields, message } }, { status });
}

export function rateLimited(resetMs: number): Response {
	const retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
	return new Response(
		JSON.stringify({
			error: { code: "rate_limited", message: "Too many requests" },
		}),
		{
			headers: {
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

export const MAX_JSON_BYTES = 262_144;

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
