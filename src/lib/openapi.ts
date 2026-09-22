interface OpenApiSchema {
	$ref?: string;
	description?: string;
	enum?: string[];
	example?: unknown;
	format?: string;
	items?: OpenApiSchema;
	maxItems?: number;
	maxLength?: number;
	minItems?: number;
	minLength?: number;
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

export function getOpenApiSpec(origin: string): OpenApiSpec {
	const slotId: OpenApiSchema = {
		description: "Slot id in event-timezone wall time",
		example: "2026-10-05T09:15",
		pattern: "^\\d{4}-\\d{2}-\\d{2}T([01]\\d|2[0-3]):(00|15|30|45)$",
		type: "string",
	};
	return {
		components: {
			schemas: {
				AvailabilityRequest: {
					properties: {
						name: { maxLength: 40, minLength: 1, type: "string" },
						password: {
							description:
								"Optional password. Sent only over HTTPS, never stored in plain text.",
							maxLength: 72,
							minLength: 4,
							type: "string",
						},
						slots: {
							items: { $ref: "#/components/schemas/SlotId" },
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
							items: { pattern: "^\\d{4}-\\d{2}-\\d{2}$", type: "string" },
							maxItems: 31,
							minItems: 1,
							type: "array",
						},
						endTime: {
							example: "17:00",
							pattern: "^([01]\\d|2[0-3]):00$",
							type: "string",
						},
						startTime: {
							example: "09:00",
							pattern: "^([01]\\d|2[0-3]):00$",
							type: "string",
						},
						timezone: { example: "America/New_York", type: "string" },
						title: { maxLength: 100, minLength: 1, type: "string" },
					},
					required: ["title", "dates", "startTime", "endTime", "timezone"],
					type: "object",
				},
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
								fields: { type: "object" },
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
						dates: { items: { type: "string" }, type: "array" },
						endTime: { type: "string" },
						expiresAt: { type: "string" },
						id: { type: "string" },
						startTime: { type: "string" },
						timezone: { type: "string" },
						title: { type: "string" },
					},
					required: [
						"id",
						"title",
						"dates",
						"startTime",
						"endTime",
						"timezone",
						"createdAt",
						"expiresAt",
					],
					type: "object",
				},
				SlotId: slotId,
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
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CreateEventRequest" },
							},
						},
						required: true,
					},
					responses: {
						"201": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/CreateEventResponse" },
								},
							},
							description: "Event created",
						},
						"400": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
							description: "Validation error",
						},
						"429": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
							description: "Rate limited",
						},
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
						"200": { description: "Event with counts and participants" },
						"404": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
							description: "Not found",
						},
						"410": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
							description: "Expired",
						},
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
						"200": { description: "Own slots for editing" },
						"401": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
							description: "Invalid password",
						},
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
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AvailabilityRequest" },
							},
						},
						required: true,
					},
					responses: {
						"200": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/AvailabilityResponse" },
								},
							},
							description: "Saved",
						},
						"401": {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Error" },
								},
							},
							description: "Invalid password",
						},
					},
					summary: "Create or update availability",
				},
			},
		},
		servers: [{ url: origin }],
	};
}
