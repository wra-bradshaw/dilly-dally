import {
	createDocument,
	type ZodOpenApiMediaTypeObject,
	type ZodOpenApiPathsObject,
	type ZodOpenApiResponseObject,
} from "zod-openapi";
import {
	addPollOptionResponseSchema,
	addPollOptionSchema,
	availabilityResponseSchema,
	availabilitySchema,
	createEventResponseSchema,
	createEventSchema,
	createPollResponseSchema,
	createPollSchema,
	errorSchema,
	eventDetailResponseSchema,
	ownAvailabilityResponseSchema,
	pollVoteResponseSchema,
	pollVoteSchema,
	sessionCreateSchema,
	sessionResponseSchema,
	weeklySlotIdSchema,
} from "./validation";

export interface OpenApiSpec {
	components: {
		schemas: Record<string, unknown>;
	};
	info: { title: string; version: string; description: string };
	openapi: string;
	paths: Record<string, unknown>;
	servers: { url: string }[];
}

type MediaSchema = NonNullable<ZodOpenApiMediaTypeObject["schema"]>;

function jsonResponse(
	description: string,
	schema: MediaSchema,
): ZodOpenApiResponseObject {
	return { content: { "application/json": { schema } }, description };
}

function jsonBody(schema: MediaSchema) {
	return { content: { "application/json": { schema } }, required: true };
}

function errorResponse(description: string): ZodOpenApiResponseObject {
	return jsonResponse(description, errorSchema);
}

function stripDefaults(node: unknown): unknown {
	if (Array.isArray(node)) return node.map(stripDefaults);
	if (node !== null && typeof node === "object") {
		return Object.fromEntries(
			Object.entries(node as Record<string, unknown>)
				.filter(([key]) => key !== "default")
				.map(([key, value]) => [key, stripDefaults(value)]),
		);
	}
	return node;
}

const eventIdParam = {
	in: "path",
	name: "id",
	required: true,
	schema: { type: "string" },
} as const;

const pollIdParam = {
	in: "path",
	name: "pollId",
	required: true,
	schema: { type: "string" },
} as const;

const optionIdParam = {
	in: "path",
	name: "optionId",
	required: true,
	schema: { type: "string" },
} as const;

const nameQueryParam = {
	in: "query",
	name: "name",
	required: true,
	schema: { type: "string" },
} as const;

const freeFormSchema = { additionalProperties: true, type: "object" } as const;

export function buildOpenApiDocument(origin: string): OpenApiSpec {
	const availabilityWriteResponses = {
		"200": jsonResponse("Saved", availabilityResponseSchema),
		"400": errorResponse("Validation error"),
		"401": errorResponse("Invalid password"),
		"404": errorResponse("Not found"),
		"410": errorResponse("Expired"),
		"413": errorResponse("Payload too large"),
		"415": errorResponse("Content-Type must be application/json"),
		"422": errorResponse("Invalid slot"),
		"429": errorResponse("Rate limited"),
	};
	const pollVoteWriteResponses = {
		"200": jsonResponse("Vote saved", pollVoteResponseSchema),
		"400": errorResponse("Validation error"),
		"401": errorResponse("Invalid password"),
		"404": errorResponse("Not found"),
		"410": errorResponse("Expired"),
		"422": errorResponse("Invalid option or selection"),
		"429": errorResponse("Rate limited"),
	};
	const paths: ZodOpenApiPathsObject = {
		"/api/events": {
			post: {
				operationId: "createEvent",
				requestBody: jsonBody(createEventSchema),
				responses: {
					"201": jsonResponse("Event created", createEventResponseSchema),
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
				parameters: [eventIdParam],
				responses: {
					"200": jsonResponse(
						"Event with counts and participants",
						eventDetailResponseSchema,
					),
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
				parameters: [eventIdParam, nameQueryParam],
				responses: {
					"200": jsonResponse(
						"Own slots for editing",
						ownAvailabilityResponseSchema,
					),
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
				parameters: [eventIdParam],
				requestBody: jsonBody(availabilitySchema),
				responses: availabilityWriteResponses,
				summary: "Create or update availability",
			},
			post: {
				operationId: "postAvailability",
				parameters: [eventIdParam],
				requestBody: jsonBody(availabilitySchema),
				responses: availabilityWriteResponses,
				summary: "Create or update availability (alias of PUT)",
			},
		},
		"/api/events/{id}/polls": {
			post: {
				operationId: "createPoll",
				parameters: [eventIdParam],
				requestBody: jsonBody(createPollSchema),
				responses: {
					"201": jsonResponse("Poll created", createPollResponseSchema),
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
				parameters: [eventIdParam, pollIdParam],
				requestBody: jsonBody(addPollOptionSchema),
				responses: {
					"201": jsonResponse("Option added", addPollOptionResponseSchema),
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
				parameters: [eventIdParam, pollIdParam, optionIdParam],
				responses: {
					"200": jsonResponse("Deleted", freeFormSchema),
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
				parameters: [eventIdParam, pollIdParam],
				requestBody: jsonBody(pollVoteSchema),
				responses: pollVoteWriteResponses,
				summary: "Vote in a poll",
			},
			post: {
				operationId: "postPollVote",
				parameters: [eventIdParam, pollIdParam],
				requestBody: jsonBody(pollVoteSchema),
				responses: pollVoteWriteResponses,
				summary: "Vote in a poll (alias of PUT)",
			},
		},
		"/api/events/{id}/sessions": {
			get: {
				operationId: "getSession",
				parameters: [eventIdParam],
				responses: {
					"200": jsonResponse(
						"Own session name and slots",
						ownAvailabilityResponseSchema,
					),
					"404": errorResponse("No session, or event not found"),
					"410": errorResponse("Expired"),
					"429": errorResponse("Rate limited"),
				},
				summary: "Get own event session",
			},
			post: {
				operationId: "createSession",
				parameters: [eventIdParam],
				requestBody: jsonBody(sessionCreateSchema),
				responses: {
					"201": jsonResponse(
						"Session created, HttpOnly session cookie set",
						sessionResponseSchema,
					),
					"400": errorResponse("Validation error"),
					"401": errorResponse("Invalid password"),
				},
				summary: "Create an event session",
			},
			delete: {
				operationId: "deleteSession",
				parameters: [eventIdParam],
				responses: {
					"200": jsonResponse("Session cleared", freeFormSchema),
				},
				summary: "Clear an event session",
			},
		},
	};
	return stripDefaults(
		createDocument({
			components: {
				schemas: { WeeklySlotId: weeklySlotIdSchema },
			},
			info: {
				description:
					"Agent-friendly when2meet replacement. Create events with curl, then add availability by name.",
				title: "Dilly-Dally API",
				version: "1.0.0",
			},
			openapi: "3.1.0",
			paths,
			servers: [{ url: origin }],
		}),
	) as OpenApiSpec;
}
