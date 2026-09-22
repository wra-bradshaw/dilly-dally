import { createServerFn } from "@tanstack/react-start";
import { type EventDetailResponse, HttpError } from "./client";
import { getDb } from "./db-env";
import { loadEventDetailFromDb } from "./server-event-detail";

export type EventDetailServerResult =
	| { detail: EventDetailResponse; ok: true }
	| { code: string; message: string; ok: false; status: number };

export const fetchEventDetailServerFn = createServerFn({ method: "GET" })
	.validator((id: unknown) => {
		if (typeof id !== "string" || id.length === 0) {
			throw new Error("Invalid event id");
		}
		return id;
	})
	.handler(async ({ data: eventId }): Promise<EventDetailServerResult> => {
		try {
			const detail = await loadEventDetailFromDb(getDb(), eventId, Date.now());
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
	});
