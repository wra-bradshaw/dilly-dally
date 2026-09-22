export interface CreateEventRequest {
	title: string;
	dates: string[];
	startTime: string;
	endTime: string;
	timezone: string;
}

export interface DillyEventDto {
	id: string;
	title: string;
	dates: string[];
	startTime: string;
	endTime: string;
	timezone: string;
	createdAt: string;
	expiresAt: string;
}

export interface CreateEventResponse {
	id: string;
	url: string;
	event: DillyEventDto;
}

export interface AvailabilityRequest {
	name: string;
	password?: string;
	slots: string[];
}

export interface AvailabilityResponse {
	name: string;
	count: number;
	protected: boolean;
	updatedAt: string;
}

export interface EventDetailResponse {
	event: DillyEventDto;
	slotUniverse: string[];
	counts: { slot: string; count: number; names: string[] }[];
	participants: { name: string; count: number; updatedAt: string }[];
	bestTimes: { slot: string; count: number }[];
}

export interface ApiError {
	error: {
		code: string;
		message: string;
		fields?: Record<string, string[]>;
	};
}
