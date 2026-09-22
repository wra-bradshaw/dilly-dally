import type {
	ApiError,
	AvailabilityRequest,
	AvailabilityResponse,
	CreateEventRequest,
	CreateEventResponse,
	EventDetailResponse,
} from "./api-types";

export class HttpError extends Error {
	status: number;
	code: string;
	fields?: Record<string, string[]>;

	constructor(
		status: number,
		code: string,
		message: string,
		fields?: Record<string, string[]>,
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.fields = fields;
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(path, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	const body = (await res.json()) as T | ApiError;
	if (!res.ok) {
		const err = body as ApiError;
		throw new HttpError(
			res.status,
			err.error?.code ?? "error",
			err.error?.message ?? res.statusText,
			err.error?.fields,
		);
	}
	return body as T;
}

export function createEvent(
	input: CreateEventRequest,
): Promise<CreateEventResponse> {
	return request<CreateEventResponse>("/api/events", {
		body: JSON.stringify(input),
		method: "POST",
	});
}

export function fetchEventDetail(id: string): Promise<EventDetailResponse> {
	return request<EventDetailResponse>(`/api/events/${id}`);
}

export function saveAvailability(
	id: string,
	input: AvailabilityRequest,
): Promise<AvailabilityResponse> {
	return request<AvailabilityResponse>(`/api/events/${id}/availability`, {
		body: JSON.stringify(input),
		method: "PUT",
	});
}

export function fetchOwnAvailability(
	id: string,
	name: string,
	password?: string,
): Promise<{ name: string; slots: string[] }> {
	const headers: Record<string, string> = {};
	if (password) headers["x-event-password"] = password;
	return request(
		`/api/events/${id}/availability?name=${encodeURIComponent(name)}`,
		{
			headers,
		},
	);
}
