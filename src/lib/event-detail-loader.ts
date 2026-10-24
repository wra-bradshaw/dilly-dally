import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { EventDetailResponse } from "./client";
import { getDb } from "./db-env";
import { retryAfterSeconds } from "./denials";
import { parseSessionCookie } from "./event-cookies";
import { HttpError } from "./http-error";
import { RATE_LIMITS } from "./rate-limit";
import { getOwnAvailability } from "./server-availability";
import { loadEventDetailFromDb, loadLiveEvent } from "./server-event-detail";
import { doRateLimit } from "./server-rate-limit";
import { resolveEventSession } from "./server-sessions";

type EventDetailServerResult =
	| { detail: EventDetailResponse; ok: true }
	| {
			code: string;
			message: string;
			ok: false;
			retryAfter?: number;
			status: number;
	  };

export function readLimitContext(
	allowed: boolean,
	resetMs: number,
	now: number,
): { limited: boolean; retryAfter?: number } {
	if (allowed) return { limited: false };
	return {
		limited: true,
		retryAfter: retryAfterSeconds(resetMs, now),
	};
}

const readRateLimit = createMiddleware({ type: "request" }).server(
	async ({ next, request }) => {
		const now = Date.now();
		const rl = await doRateLimit(request, "read", RATE_LIMITS.read);
		const decision = readLimitContext(rl.allowed, rl.resetMs, now);
		return next({
			context: {
				readRateLimited: decision.limited,
				readRetryAfter: decision.retryAfter,
			},
		});
	},
);

export const fetchEventDetailServerFn = createServerFn({ method: "GET" })
	.middleware([readRateLimit])
	.validator((id: unknown) => {
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("Invalid event id");
		}
		return id;
	})
	.handler(
		async ({ context, data: eventId }): Promise<EventDetailServerResult> => {
			try {
				if (context.readRateLimited) {
					return {
						code: "rate_limited",
						message: "Too many requests",
						ok: false,
						retryAfter: context.readRetryAfter,
						status: 429,
					};
				}
				const detail = await loadEventDetailFromDb(
					getDb(),
					eventId,
					Date.now(),
				);
				return { detail, ok: true };
			} catch (err) {
				if (err instanceof HttpError) {
					return {
						code: err.code,
						message: err.message,
						ok: false,
						status: err.status,
					};
				}
				throw err;
			}
		},
	);

export type OwnSessionServerResult =
	| { name: string; ok: true; slots: string[] }
	| { code: string; ok: false };

export const fetchOwnSessionServerFn = createServerFn({ method: "GET" })
	.middleware([readRateLimit])
	.validator((id: unknown) => {
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("Invalid event id");
		}
		return id;
	})
	.handler(
		async ({ context, data: eventId }): Promise<OwnSessionServerResult> => {
			if (context.readRateLimited) {
				return { code: "rate_limited", ok: false };
			}
			try {
				const request = getRequest();
				const token = parseSessionCookie(
					request.headers.get("cookie"),
					eventId,
				);
				if (!token) return { code: "none", ok: false };
				const db = getDb();
				const now = Date.now();
				const resolved = await resolveEventSession(db, token, now);
				if (!resolved.ok) return { code: resolved.code, ok: false };
				if (resolved.eventId !== eventId)
					return { code: "mismatch", ok: false };
				const loaded = await loadLiveEvent(db, eventId, now);
				if (!loaded.ok) return { code: loaded.code, ok: false };
				const own = await getOwnAvailability(
					db,
					loaded.event,
					resolved.name,
					null,
					undefined,
					{ sessionNameKey: resolved.nameKey },
				);
				if (!own.ok) return { code: own.code, ok: false };
				return { name: own.name, ok: true, slots: own.slots };
			} catch {
				return { code: "error", ok: false };
			}
		},
	);
