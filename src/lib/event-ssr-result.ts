import type { EventDetailResponse } from "./client";

export type EventDetailSsrResult =
	| { detail: EventDetailResponse; ok: true }
	| {
			code: string;
			message: string;
			ok: false;
			retryAfter?: number;
			status: number;
	  };

export type OwnSessionSsrResult =
	| { name: string; ok: true; slots: string[] }
	| { code: string; ok: false };

function retryAfterFromHeaders(response: Response): number | undefined {
	const raw = response.headers.get("Retry-After");
	if (!raw) return undefined;
	const n = Number(raw);
	return Number.isFinite(n) ? n : undefined;
}

export function toEventDetailSsrResult(
	response: Response,
	body: unknown,
): EventDetailSsrResult {
	if (response.ok) return { detail: body as EventDetailResponse, ok: true };
	const err = (body ?? {}) as { error?: { code?: string; message?: string } };
	return {
		code: err.error?.code ?? "error",
		message: err.error?.message ?? response.statusText,
		ok: false,
		retryAfter: retryAfterFromHeaders(response),
		status: response.status,
	};
}

export function toOwnSessionSsrResult(
	response: Response,
	body: unknown,
): OwnSessionSsrResult {
	if (response.ok) {
		const data = body as { name: string; slots: string[] };
		return { name: data.name, ok: true, slots: data.slots };
	}
	const err = (body ?? {}) as { error?: { code?: string } };
	return { code: err.error?.code ?? "error", ok: false };
}
