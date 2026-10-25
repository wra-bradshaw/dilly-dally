import { z } from "zod";
import {
	addPollOptionSchema,
	availabilitySchema,
	createEventSchema,
	createPollSchema,
	dateRe,
	eventModeSchema,
	hourRe,
	pollVoteSchema,
	sessionCreateSchema,
	slotRe,
	weekdaySchema,
	weeklySlotRe,
} from "./validation";

interface OpenApiSchema {
	$ref?: string;
	additionalProperties?: OpenApiSchema | boolean;
	description?: string;
	enum?: string[];
	example?: unknown;
	format?: string;
	items?: OpenApiSchema;
	maxItems?: number;
	maxLength?: number;
	minItems?: number;
	minLength?: number;
	minimum?: number;
	maximum?: number;
	nullable?: boolean;
	pattern?: string;
	properties?: Record<string, OpenApiSchema>;
	required?: string[];
	type?: string;
}

export interface OpenApiSpec {
	components: {
		schemas: Record<string, OpenApiSchema>;
	};
	info: { title: string; version: string; description: string };
	openapi: string;
	paths: Record<string, unknown>;
	servers: { url: string }[];
}

function stripAnchors(source: string): string {
	return source.replace(/^\^/, "").replace(/\$$/, "");
}

function reqOf(json: {
	required?: string[];
	properties?: Record<string, { default?: unknown }>;
}): string[] {
	const required: string[] = json.required ?? [];
	const props = json.properties ?? {};
	return required.filter((k) => props[k]?.default === undefined);
}

function buildSlotPattern(): string {
	return `^(${stripAnchors(slotRe.source)}|${stripAnchors(weeklySlotRe.source)})$`;
}

function errorRef(): OpenApiSchema {
	return { $ref: "#/components/schemas/Error" };
}

function jsonContent(schema: OpenApiSchema): unknown {
	return { "application/json": { schema } };
}

function errorResponse(description: string): unknown {
	return { content: jsonContent(errorRef()), description };
}

export function buildOpenApiDocument(origin: string): OpenApiSpec {
	const createJson = z.toJSONSchema(createEventSchema) as {
		properties: Record<
			string,
			{
				minLength?: number;
				maxLength?: number;
				minItems?: number;
				maxItems?: number;
			}
		>;
		required?: string[];
	};
	const availJson = z.toJSONSchema(availabilitySchema) as {
		properties: Record<
			string,
			{ minLength?: number; maxLength?: number; maxItems?: number }
		>;
	};
	const pollJson = z.toJSONSchema(createPollSchema) as {
		properties: Record<
			string,
			{
				minLength?: number;
				maxLength?: number;
				minItems?: number;
				maxItems?: number;
				items?: { minLength?: number; maxLength?: number };
			}
		>;
	};
	const addOptJson = z.toJSONSchema(addPollOptionSchema) as {
		properties: Record<string, { minLength?: number; maxLength?: number }>;
	};
	const voteJson = z.toJSONSchema(pollVoteSchema) as {
		properties: Record<
			string,
			{
				minLength?: number;
				maxLength?: number;
				maxItems?: number;
				items?: { minLength?: number; maxLength?: number };
			}
		>;
	};
	const sessJson = z.toJSONSchema(sessionCreateSchema) as {
		properties: Record<string, { minLength?: number; maxLength?: number }>;
	};
	const modeJson = z.toJSONSchema(eventModeSchema) as { enum?: string[] };
	const weekdayJson = z.toJSONSchema(weekdaySchema) as {
		minimum?: number;
		maximum?: number;
	};
	const createFull = z.toJSONSchema(createEventSchema) as {
		required?: string[];
		properties?: Record<string, { default?: unknown }>;
	};
	const datePattern = dateRe.source;
	const hourPattern = hourRe.source;
	const weeklyPattern = weeklySlotRe.source;
	const slotPattern = buildSlotPattern();
	const modeEnum = JSON.stringify(modeJson.enum);
	const weekdayMin = weekdayJson.minimum;
	const weekdayMax = weekdayJson.maximum;
	const titleMin = createJson.properties.title?.minLength;
	const titleMax = createJson.properties.title?.maxLength;
	const tzMin = createJson.properties.timezone?.minLength;
	const tzMax = createJson.properties.timezone?.maxLength;
	const datesMin = createJson.properties.dates?.minItems;
	const datesMax = createJson.properties.dates?.maxItems;
	const pollsMax = createJson.properties.polls?.maxItems;
	const weekdaysMax = createJson.properties.weekdays?.maxItems;
	const availNameMin = availJson.properties.name?.minLength;
	const availNameMax = availJson.properties.name?.maxLength;
	const slotsMax = availJson.properties.slots?.maxItems;
	const pwdMin = availJson.properties.password?.minLength;
	const pwdMax = availJson.properties.password?.maxLength;
	const qMin = pollJson.properties.question?.minLength;
	const qMax = pollJson.properties.question?.maxLength;
	const optsMin = pollJson.properties.options?.minItems;
	const optsMax = pollJson.properties.options?.maxItems;
	const optItemMin = pollJson.properties.options?.items?.minLength;
	const optItemMax = pollJson.properties.options?.items?.maxLength;
	const labelMin = addOptJson.properties.label?.minLength;
	const labelMax = addOptJson.properties.label?.maxLength;
	const voteOptMax = voteJson.properties.optionIds?.maxItems;
	const voteOptItemMin = voteJson.properties.optionIds?.items?.minLength;
	const voteOptItemMax = voteJson.properties.optionIds?.items?.maxLength;
	const sessNameMin = sessJson.properties.name?.minLength;
	const sessNameMax = sessJson.properties.name?.maxLength;
	const createRequired = JSON.stringify(reqOf(createFull));
	const slotId: OpenApiSchema = {
		description:
			"Slot id in event-timezone wall time. Date events use YYYY-MM-DDTHH:mm; weekly events use DOW-HH:mm like MON-09:30.",
		example: "2026-10-05T09:30",
		pattern: slotPattern,
		type: "string",
	};
	const weeklySlotId: OpenApiSchema = {
		description:
			"Weekly slot id: weekday code plus HH:mm. Monday is MON, Sunday is SUN.",
		example: "MON-09:30",
		pattern: weeklyPattern,
		type: "string",
	};
	const parsedModeEnum = JSON.parse(modeEnum) as string[];
	const parsedCreateRequired = JSON.parse(createRequired) as string[];
	return {
		components: {
			schemas: {
				AvailabilityRequest: {
					properties: {
						name: {
							maxLength: availNameMax,
							minLength: availNameMin,
							type: "string",
						},
						password: {
							description:
								"Optional password. Sent only over HTTPS, never stored in plain text.",
							maxLength: pwdMax,
							minLength: pwdMin,
							type: "string",
						},
						slots: {
							description:
								"Full replace set of slot ids. Date events use YYYY-MM-DDTHH:mm; weekly events use DOW-HH:mm like MON-09:30. Empty array means unavailable everywhere.",
							items: { $ref: "#/components/schemas/SlotId" },
							maxItems: slotsMax,
							type: "array",
						},
					},
					required: ["name", "slots"],
					type: "object",
				},
				AvailabilityResponse: {
					properties: {
						count: { type: "integer" },
						name: { type: "string" },
						protected: { type: "boolean" },
						updatedAt: { type: "string" },
					},
					required: ["name", "count", "protected", "updatedAt"],
					type: "object",
				},
				CreateEventRequest: {
					properties: {
						dates: {
							description:
								"1..31 entries, YYYY-MM-DD, each today (UTC) through today+90 inclusive. Required when mode is dates (the default). Omit or send [] for weekly events.",
							items: { pattern: datePattern, type: "string" },
							maxItems: datesMax,
							minItems: datesMin,
							type: "array",
						},
						endTime: {
							example: "17:00",
							pattern: hourPattern,
							type: "string",
						},
						mode: { $ref: "#/components/schemas/EventMode" },
						polls: {
							description:
								"Optional 0..10 polls created with the event. Each needs question 1..140 chars and 2..10 unique options 1..80 chars.",
							items: { $ref: "#/components/schemas/CreatePollRequest" },
							maxItems: pollsMax,
							type: "array",
						},
						startTime: {
							example: "09:00",
							pattern: hourPattern,
							type: "string",
						},
						timezone: {
							example: "America/New_York",
							maxLength: tzMax,
							minLength: tzMin,
							type: "string",
						},
						title: { maxLength: titleMax, minLength: titleMin, type: "string" },
						weekdays: {
							description:
								"Required when mode is weekly. 1..7 unique entries, 0=Sunday through 6=Saturday. Example [1,3,5] means Mon/Wed/Fri.",
							items: { $ref: "#/components/schemas/Weekday" },
							maxItems: weekdaysMax,
							type: "array",
						},
					},
					required: parsedCreateRequired,
					type: "object",
				},
				CreatePollRequest: {
					properties: {
						allowMultiple: {
							description:
								"When true voters may pick multiple options, otherwise single choice.",
							type: "boolean",
						},
						options: {
							items: {
								maxLength: optItemMax,
								minLength: optItemMin,
								type: "string",
							},
							maxItems: optsMax,
							minItems: optsMin,
							type: "array",
						},
						question: { maxLength: qMax, minLength: qMin, type: "string" },
					},
					required: ["question", "options"],
					type: "object",
				},
				PollOption: {
					properties: {
						count: { type: "integer" },
						id: { type: "string" },
						label: { type: "string" },
						names: { items: { type: "string" }, type: "array" },
					},
					required: ["id", "label", "count", "names"],
					type: "object",
				},
				Poll: {
					properties: {
						allowMultiple: { type: "boolean" },
						id: { type: "string" },
						options: {
							items: { $ref: "#/components/schemas/PollOption" },
							type: "array",
						},
						question: { type: "string" },
						totalVoters: { type: "integer" },
					},
					required: [
						"id",
						"question",
						"allowMultiple",
						"options",
						"totalVoters",
					],
					type: "object",
				},
				CreatePollResponse: {
					properties: {
						poll: { $ref: "#/components/schemas/Poll" },
					},
					required: ["poll"],
					type: "object",
				},
				AddPollOptionRequest: {
					properties: {
						label: { maxLength: labelMax, minLength: labelMin, type: "string" },
					},
					required: ["label"],
					type: "object",
				},
				AddPollOptionResponse: {
					properties: {
						id: { type: "string" },
						label: { type: "string" },
					},
					required: ["id", "label"],
					type: "object",
				},
				PollVoteRequest: {
					properties: {
						name: {
							maxLength: availNameMax,
							minLength: availNameMin,
							type: "string",
						},
						optionIds: {
							description:
								"Full replace set of option ids for this poll. Empty array clears the vote.",
							items: {
								maxLength: voteOptItemMax,
								minLength: voteOptItemMin,
								type: "string",
							},
							maxItems: voteOptMax,
							type: "array",
						},
						password: {
							description:
								"Optional password, same identity as availability. Required when the name is password-protected.",
							maxLength: pwdMax,
							minLength: pwdMin,
							type: "string",
						},
					},
					required: ["name", "optionIds"],
					type: "object",
				},
				PollVoteResponse: {
					properties: {
						pollId: { type: "string" },
					},
					required: ["pollId"],
					type: "object",
				},
				EventMode: {
					description:
						"dates picks specific dates; weekly repeats on weekdays.",
					enum: parsedModeEnum,
					example: "dates",
					type: "string",
				},
				Weekday: {
					description: "Day of week, 0=Sunday through 6=Saturday.",
					example: 1,
					maximum: weekdayMax,
					minimum: weekdayMin,
					type: "integer",
				},
				WeeklySlotId: weeklySlotId,
				CreateEventResponse: {
					properties: {
						event: { $ref: "#/components/schemas/Event" },
						id: { type: "string" },
						url: { type: "string" },
					},
					required: ["id", "url", "event"],
					type: "object",
				},
				Error: {
					properties: {
						error: {
							properties: {
								code: { type: "string" },
								fields: {
									additionalProperties: {
										items: { type: "string" },
										type: "array",
									},
									type: "object",
								},
								message: { type: "string" },
							},
							required: ["code", "message"],
							type: "object",
						},
					},
					required: ["error"],
					type: "object",
				},
				Event: {
					properties: {
						createdAt: { type: "string" },
						dates: {
							description:
								"Specific dates for dates events; empty array for weekly events.",
							items: { type: "string" },
							type: "array",
						},
						endTime: { type: "string" },
						expiresAt: { type: "string" },
						id: { type: "string" },
						mode: { $ref: "#/components/schemas/EventMode" },
						startTime: { type: "string" },
						timezone: { type: "string" },
						title: { type: "string" },
						weekdays: {
							description:
								"Weekdays for weekly events, 0=Sunday through 6=Saturday; empty array for dates events.",
							items: { $ref: "#/components/schemas/Weekday" },
							type: "array",
						},
					},
					required: [
						"id",
						"title",
						"mode",
						"dates",
						"weekdays",
						"startTime",
						"endTime",
						"timezone",
						"createdAt",
						"expiresAt",
					],
					type: "object",
				},
				SlotId: slotId,
				EventDetailResponse: {
					properties: {
						bestTimes: {
							items: {
								properties: {
									count: { type: "integer" },
									slot: { type: "string" },
								},
								required: ["slot", "count"],
								type: "object",
							},
							type: "array",
						},
						counts: {
							items: {
								properties: {
									count: { type: "integer" },
									names: { items: { type: "string" }, type: "array" },
									slot: { type: "string" },
								},
								required: ["slot", "count", "names"],
								type: "object",
							},
							type: "array",
						},
						event: { $ref: "#/components/schemas/Event" },
						participants: {
							items: {
								properties: {
									count: { type: "integer" },
									name: { type: "string" },
									updatedAt: { type: "string" },
								},
								required: ["name", "count", "updatedAt"],
								type: "object",
							},
							type: "array",
						},
						polls: {
							description:
								"Polls for this event, each with public vote counts and voter names.",
							items: { $ref: "#/components/schemas/Poll" },
							type: "array",
						},
						slotUniverse: { items: { type: "string" }, type: "array" },
					},
					required: [
						"event",
						"slotUniverse",
						"counts",
						"participants",
						"bestTimes",
						"polls",
					],
					type: "object",
				},
				OwnAvailabilityResponse: {
					properties: {
						name: { type: "string" },
						slots: { items: { type: "string" }, type: "array" },
					},
					required: ["name", "slots"],
					type: "object",
				},
				SessionRequest: {
					properties: {
						name: {
							maxLength: sessNameMax,
							minLength: sessNameMin,
							type: "string",
						},
						password: {
							description:
								"Optional password, required when the name is password-protected. Never stored, only used to mint a short-lived session cookie.",
							maxLength: pwdMax,
							minLength: pwdMin,
							type: "string",
						},
					},
					required: ["name"],
					type: "object",
				},
				SessionResponse: {
					properties: {
						name: { type: "string" },
					},
					required: ["name"],
					type: "object",
				},
			},
		},
		info: {
			description:
				"Agent-friendly when2meet replacement. Create events with curl, then add availability by name.",
			title: "Dilly-Dally API",
			version: "1.0.0",
		},
		openapi: "3.1.0",
		paths: {
			"/api/events": {
				post: {
					operationId: "createEvent",
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/CreateEventRequest",
						}),
						required: true,
					},
					responses: {
						"201": {
							content: jsonContent({
								$ref: "#/components/schemas/CreateEventResponse",
							}),
							description: "Event created",
						},
						"400": errorResponse("Validation error"),
						"413": errorResponse("Payload too large"),
						"415": errorResponse("Content-Type must be application/json"),
						"429": errorResponse("Rate limited"),
						"500": errorResponse("Internal error"),
					},
					summary: "Create an event",
				},
			},
			"/api/events/{id}": {
				get: {
					operationId: "getEvent",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							content: jsonContent({
								$ref: "#/components/schemas/EventDetailResponse",
							}),
							description: "Event with counts and participants",
						},
						"404": errorResponse("Not found"),
						"410": errorResponse("Expired"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Get event and group availability",
				},
			},
			"/api/events/{id}/availability": {
				get: {
					operationId: "getAvailability",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
						{
							in: "query",
							name: "name",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							content: jsonContent({
								$ref: "#/components/schemas/OwnAvailabilityResponse",
							}),
							description: "Own slots for editing",
						},
						"400": errorResponse("Validation error"),
						"401": errorResponse("Invalid password"),
						"404": errorResponse(
							"Event not found, or no availability for this name (availability_not_found)",
						),
						"410": errorResponse("Expired"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Get own availability",
				},
				put: {
					operationId: "putAvailability",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
					],
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/AvailabilityRequest",
						}),
						required: true,
					},
					responses: {
						"200": {
							content: jsonContent({
								$ref: "#/components/schemas/AvailabilityResponse",
							}),
							description: "Saved",
						},
						"400": errorResponse("Validation error"),
						"401": errorResponse("Invalid password"),
						"404": errorResponse("Not found"),
						"410": errorResponse("Expired"),
						"413": errorResponse("Payload too large"),
						"415": errorResponse("Content-Type must be application/json"),
						"422": errorResponse("Invalid slot"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Create or update availability",
				},
				post: {
					operationId: "postAvailability",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
					],
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/AvailabilityRequest",
						}),
						required: true,
					},
					responses: {
						"200": {
							content: jsonContent({
								$ref: "#/components/schemas/AvailabilityResponse",
							}),
							description: "Saved",
						},
						"400": errorResponse("Validation error"),
						"401": errorResponse("Invalid password"),
						"404": errorResponse("Not found"),
						"410": errorResponse("Expired"),
						"413": errorResponse("Payload too large"),
						"415": errorResponse("Content-Type must be application/json"),
						"422": errorResponse("Invalid slot"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Create or update availability (alias of PUT)",
				},
			},
			"/api/events/{id}/polls": {
				post: {
					operationId: "createPoll",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
					],
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/CreatePollRequest",
						}),
						required: true,
					},
					responses: {
						"201": {
							content: jsonContent({
								$ref: "#/components/schemas/CreatePollResponse",
							}),
							description: "Poll created",
						},
						"400": errorResponse("Validation error"),
						"404": errorResponse("Not found"),
						"409": errorResponse("Duplicate or too many polls"),
						"410": errorResponse("Expired"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Add a poll to an event",
				},
			},
			"/api/events/{id}/polls/{pollId}/options": {
				post: {
					operationId: "addPollOption",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
						{
							in: "path",
							name: "pollId",
							required: true,
							schema: { type: "string" },
						},
					],
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/AddPollOptionRequest",
						}),
						required: true,
					},
					responses: {
						"201": {
							content: jsonContent({
								$ref: "#/components/schemas/AddPollOptionResponse",
							}),
							description: "Option added",
						},
						"400": errorResponse("Validation error"),
						"404": errorResponse("Not found"),
						"409": errorResponse("Duplicate or too many options"),
						"410": errorResponse("Expired"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Add an option to a poll",
				},
			},
			"/api/events/{id}/polls/{pollId}/options/{optionId}": {
				delete: {
					operationId: "deletePollOption",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
						{
							in: "path",
							name: "pollId",
							required: true,
							schema: { type: "string" },
						},
						{
							in: "path",
							name: "optionId",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							content: jsonContent({
								additionalProperties: true,
								type: "object",
							}),
							description: "Deleted",
						},
						"404": errorResponse("Not found"),
						"409": errorResponse("Option has votes and cannot be removed"),
						"410": errorResponse("Expired"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Remove an unvoted poll option",
				},
			},
			"/api/events/{id}/polls/{pollId}/vote": {
				put: {
					operationId: "putPollVote",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
						{
							in: "path",
							name: "pollId",
							required: true,
							schema: { type: "string" },
						},
					],
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/PollVoteRequest",
						}),
						required: true,
					},
					responses: {
						"200": {
							content: jsonContent({
								$ref: "#/components/schemas/PollVoteResponse",
							}),
							description: "Vote saved",
						},
						"400": errorResponse("Validation error"),
						"401": errorResponse("Invalid password"),
						"404": errorResponse("Not found"),
						"410": errorResponse("Expired"),
						"422": errorResponse("Invalid option or selection"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Vote in a poll",
				},
				post: {
					operationId: "postPollVote",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
						{
							in: "path",
							name: "pollId",
							required: true,
							schema: { type: "string" },
						},
					],
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/PollVoteRequest",
						}),
						required: true,
					},
					responses: {
						"200": {
							content: jsonContent({
								$ref: "#/components/schemas/PollVoteResponse",
							}),
							description: "Vote saved",
						},
						"400": errorResponse("Validation error"),
						"401": errorResponse("Invalid password"),
						"404": errorResponse("Not found"),
						"410": errorResponse("Expired"),
						"422": errorResponse("Invalid option or selection"),
						"429": errorResponse("Rate limited"),
					},
					summary: "Vote in a poll (alias of PUT)",
				},
			},
			"/api/events/{id}/sessions": {
				post: {
					operationId: "createSession",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
					],
					requestBody: {
						content: jsonContent({
							$ref: "#/components/schemas/SessionRequest",
						}),
						required: true,
					},
					responses: {
						"201": {
							content: jsonContent({
								$ref: "#/components/schemas/SessionResponse",
							}),
							description: "Session created, HttpOnly session cookie set",
						},
						"400": errorResponse("Validation error"),
						"401": errorResponse("Invalid password"),
					},
					summary: "Create an event session",
				},
				delete: {
					operationId: "deleteSession",
					parameters: [
						{
							in: "path",
							name: "id",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {
						"200": {
							content: jsonContent({
								additionalProperties: true,
								type: "object",
							}),
							description: "Session cleared",
						},
					},
					summary: "Clear an event session",
				},
			},
		},
		servers: [{ url: origin }],
	};
}
