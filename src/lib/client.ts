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

function unwrap<T>(result: {
	data?: T;
	error?: unknown;
	response: Response;
}): T {
	if (!result.response.ok) {
		throw toHttpError(
			result.response.status,
			result.error,
			result.response.statusText,
		);
	}
	return result.data as T;
}

export async function createEvent(
	input: CreateEventRequest,
): Promise<CreateEventResponse> {
	return unwrap<CreateEventResponse>(
		await client.POST("/api/events", {
			body: input,
		}),
	);
}

export async function fetchEventDetail(
	id: string,
): Promise<EventDetailResponse> {
	return unwrap<EventDetailResponse>(
		await client.GET("/api/events/{id}", {
			params: { path: { id } },
		}),
	);
}

export async function saveAvailability(
	id: string,
	input: AvailabilityRequest,
): Promise<AvailabilityResponse> {
	return unwrap<AvailabilityResponse>(
		await client.PUT("/api/events/{id}/availability", {
			body: input,
			params: { path: { id } },
		}),
	);
}

export async function fetchOwnAvailability(
	id: string,
	name: string,
	password?: string,
): Promise<OwnAvailabilityResponse> {
	return unwrap<OwnAvailabilityResponse>(
		await client.GET("/api/events/{id}/availability", {
			headers: password ? { "x-event-password": password } : undefined,
			params: { path: { id }, query: { name } },
		}),
	);
}

export async function createPoll(
	id: string,
	input: CreatePollRequest,
): Promise<CreatePollResponse> {
	return unwrap<CreatePollResponse>(
		await client.POST("/api/events/{id}/polls", {
			body: input,
			params: { path: { id } },
		}),
	);
}

export async function addPollOption(
	id: string,
	pollId: string,
	input: AddPollOptionRequest,
): Promise<AddPollOptionResponse> {
	return unwrap<AddPollOptionResponse>(
		await client.POST("/api/events/{id}/polls/{pollId}/options", {
			body: input,
			params: { path: { id, pollId } },
		}),
	);
}

export async function deletePollOption(
	id: string,
	pollId: string,
	optionId: string,
): Promise<unknown> {
	return unwrap<unknown>(
		await client.DELETE("/api/events/{id}/polls/{pollId}/options/{optionId}", {
			params: { path: { id, optionId, pollId } },
		}),
	);
}

export async function votePoll(
	id: string,
	pollId: string,
	input: PollVoteRequest,
): Promise<PollVoteResponse> {
	return unwrap<PollVoteResponse>(
		await client.PUT("/api/events/{id}/polls/{pollId}/vote", {
			body: input,
			params: { path: { id, pollId } },
		}),
	);
}

export type SessionRequest = components["schemas"]["SessionRequest"];
export type SessionResponse = components["schemas"]["SessionResponse"];

export async function createEventSession(
	id: string,
	input: SessionRequest,
): Promise<SessionResponse> {
	return unwrap<SessionResponse>(
		await client.POST("/api/events/{id}/sessions", {
			body: input,
			params: { path: { id } },
		}),
	);
}

export async function deleteEventSession(id: string): Promise<void> {
	await unwrap<unknown>(
		await client.DELETE("/api/events/{id}/sessions", {
			params: { path: { id } },
		}),
	);
}
