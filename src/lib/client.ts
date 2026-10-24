import createClient from "openapi-fetch";
import type { components, paths } from "./api-schema";
import { HttpError } from "./http-error";

export type CreateEventRequest = components["schemas"]["CreateEventRequest"];
export type CreateEventResponse = components["schemas"]["CreateEventResponse"];
export type EventDetailResponse = components["schemas"]["EventDetailResponse"];
export type AvailabilityRequest = components["schemas"]["AvailabilityRequest"];
export type AvailabilityResponse =
	components["schemas"]["AvailabilityResponse"];
export type OwnAvailabilityResponse =
	components["schemas"]["OwnAvailabilityResponse"];
export type CreatePollRequest = components["schemas"]["CreatePollRequest"];
export type CreatePollResponse = components["schemas"]["CreatePollResponse"];
export type AddPollOptionRequest =
	components["schemas"]["AddPollOptionRequest"];
export type AddPollOptionResponse =
	components["schemas"]["AddPollOptionResponse"];
export type PollVoteRequest = components["schemas"]["PollVoteRequest"];
export type PollVoteResponse = components["schemas"]["PollVoteResponse"];
export type Poll = components["schemas"]["Poll"];

const client = createClient<paths>({
	baseUrl:
		typeof window !== "undefined" && window.location?.origin
			? window.location.origin
			: "",
	fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
		globalThis.fetch(input, {
			...init,
			credentials: "include",
		})) as typeof fetch,
});

interface ErrorBody {
	error?: {
		code?: string;
		message?: string;
		fields?: Record<string, string[]>;
	};
}

function toHttpError(
	status: number,
	body: unknown,
	fallback: string,
): HttpError {
	const err = (body ?? {}) as ErrorBody;
	return new HttpError(
		status,
		err.error?.code ?? "error",
		err.error?.message ?? fallback,
		err.error?.fields,
	);
}

export async function createEvent(
	input: CreateEventRequest,
): Promise<CreateEventResponse> {
	const { data, error, response } = await client.POST("/api/events", {
		body: input,
	});
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data as CreateEventResponse;
}

export async function fetchEventDetail(
	id: string,
): Promise<EventDetailResponse> {
	const { data, error, response } = await client.GET("/api/events/{id}", {
		params: { path: { id } },
	});
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data as EventDetailResponse;
}

export async function saveAvailability(
	id: string,
	input: AvailabilityRequest,
): Promise<AvailabilityResponse> {
	const { data, error, response } = await client.PUT(
		"/api/events/{id}/availability",
		{
			body: input,
			params: { path: { id } },
		},
	);
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data as AvailabilityResponse;
}

export async function fetchOwnAvailability(
	id: string,
	name: string,
	password?: string,
): Promise<OwnAvailabilityResponse> {
	const { data, error, response } = await client.GET(
		"/api/events/{id}/availability",
		{
			headers: password ? { "x-event-password": password } : undefined,
			params: { path: { id }, query: { name } },
		},
	);
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data as OwnAvailabilityResponse;
}

export async function createPoll(
	id: string,
	input: CreatePollRequest,
): Promise<CreatePollResponse> {
	const { data, error, response } = await client.POST(
		"/api/events/{id}/polls",
		{
			body: input,
			params: { path: { id } },
		},
	);
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data as CreatePollResponse;
}

export async function addPollOption(
	id: string,
	pollId: string,
	input: AddPollOptionRequest,
): Promise<AddPollOptionResponse> {
	const { data, error, response } = await client.POST(
		"/api/events/{id}/polls/{pollId}/options",
		{
			body: input,
			params: { path: { id, pollId } },
		},
	);
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data as AddPollOptionResponse;
}

export async function deletePollOption(
	id: string,
	pollId: string,
	optionId: string,
): Promise<unknown> {
	const { data, error, response } = await client.DELETE(
		"/api/events/{id}/polls/{pollId}/options/{optionId}",
		{
			params: { path: { id, optionId, pollId } },
		},
	);
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data;
}

export async function votePoll(
	id: string,
	pollId: string,
	input: PollVoteRequest,
): Promise<PollVoteResponse> {
	const { data, error, response } = await client.PUT(
		"/api/events/{id}/polls/{pollId}/vote",
		{
			body: input,
			params: { path: { id, pollId } },
		},
	);
	if (!response.ok) {
		throw toHttpError(response.status, error, response.statusText);
	}
	return data as PollVoteResponse;
}

export interface SessionResponse {
	name: string;
}

export async function createEventSession(
	id: string,
	input: { name: string; password?: string },
): Promise<SessionResponse> {
	const res = await globalThis.fetch(`/api/events/${id}/sessions`, {
		body: JSON.stringify(input),
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw toHttpError(res.status, body, res.statusText);
	}
	return (await res.json()) as SessionResponse;
}

export async function deleteEventSession(id: string): Promise<void> {
	await globalThis.fetch(`/api/events/${id}/sessions`, {
		credentials: "include",
		method: "DELETE",
	});
}
