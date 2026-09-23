import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { clientIp } from "./api-errors";
import { type EventDetailResponse, HttpError } from "./client";
import { getDb } from "./db-env";
import { RATE_LIMITS, rateLimitKey } from "./rate-limit";
import { loadEventDetailFromDb } from "./server-event-detail";
import { checkRateLimitDb } from "./server-rate-limit";

type EventDetailServerResult =
	| { detail: EventDetailResponse; ok: true }
	| { code: string; message: string; ok: false; status: number };

const readRateLimit = createMiddleware({ type: "request" }).server(
	async ({ next, request }) => {
		const key = await rateLimitKey(clientIp(request), "read");
		const rl = await checkRateLimitDb(
			getDb(),
			key,
			Date.now(),
			RATE_LIMITS.read.windowMs,
			RATE_LIMITS.read.limit,
		);
		return next({ context: { readRateLimited: !rl.allowed } });
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
					throw new HttpError(429, "rate_limited", "Too many requests");
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
