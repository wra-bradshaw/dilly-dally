import { handleGetDetail } from "../routes/api/events/$eventId/index";
import { getOwnSessionResponse } from "../routes/api/events/$eventId/sessions";
import { originOf } from "./api-errors";
import {
	type EventDetailSsrResult,
	type OwnSessionSsrResult,
	toEventDetailSsrResult,
	toOwnSessionSsrResult,
} from "./event-ssr-result";

export type { EventDetailSsrResult, OwnSessionSsrResult };

export async function readEventDetailSsr(
	eventId: string,
	request: Request,
): Promise<EventDetailSsrResult> {
	const response = await handleGetDetail(eventId, request);
	const body: unknown = await response.json();
	return toEventDetailSsrResult(response, body);
}

export async function readOwnSessionSsr(
	eventId: string,
	request: Request,
): Promise<OwnSessionSsrResult> {
	const response = await getOwnSessionResponse(eventId, request);
	const body: unknown = await response.json();
	return toOwnSessionSsrResult(response, body);
}

export function readInviteOriginSsr(request: Request): string {
	return originOf(request);
}
