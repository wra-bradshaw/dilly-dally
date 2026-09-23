import createClient from "openapi-fetch";
import type { components, paths } from "./api-schema";

export type CreateEventRequest = components["schemas"]["CreateEventRequest"];
export type CreateEventResponse = components["schemas"]["CreateEventResponse"];
export type EventDetailResponse = components["schemas"]["EventDetailResponse"];
export type AvailabilityRequest = components["schemas"]["AvailabilityRequest"];
export type AvailabilityResponse =
	components["schemas"]["AvailabilityResponse"];
export type OwnAvailabilityResponse =
	components["schemas"]["OwnAvailabilityResponse"];

export class HttpError extends Error {
	status: number;
	code: string;
	fields?: Record<string, string[]>;
	retryAfter?: number;

	constructor(
		status: number,
		code: string,
		message: string,
		fields?: Record<string, string[]>,
		retryAfter?: number,
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.fields = fields;
		this.retryAfter = retryAfter;
	}
}

const client = createClient<paths>({
	baseUrl:
		typeof window !== "undefined" && window.location?.origin
			? window.location.origin
			: "",
	fetch: ((...args: Parameters<typeof fetch>) =>
		globalThis.fetch(...args)) as typeof fetch,
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
