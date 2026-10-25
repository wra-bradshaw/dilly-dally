import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type {
	EventDetailSsrResult,
	OwnSessionSsrResult,
} from "./event-ssr-result";

function eventIdValidator(id: unknown): string {
	if (typeof id !== "string" || id.length === 0) {
		throw new Error("Invalid event id");
	}
	return id;
}

export const fetchEventDetailSsrFn = createServerFn({ method: "GET" })
	.validator(eventIdValidator)
	.handler(async ({ data: eventId }): Promise<EventDetailSsrResult> => {
		const { readEventDetailSsr } = await import("./event-ssr-server");
		return readEventDetailSsr(eventId, getRequest());
	});

export const fetchOwnSessionSsrFn = createServerFn({ method: "GET" })
	.validator(eventIdValidator)
	.handler(async ({ data: eventId }): Promise<OwnSessionSsrResult> => {
		const { readOwnSessionSsr } = await import("./event-ssr-server");
		return readOwnSessionSsr(eventId, getRequest());
	});

export const fetchInviteOriginSsrFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<string> => {
		const { readInviteOriginSsr } = await import("./event-ssr-server");
		return readInviteOriginSsr(getRequest());
	},
);
