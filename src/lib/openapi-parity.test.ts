import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getOpenApiSpec } from "./openapi";
import {
	addPollOptionSchema,
	availabilitySchema,
	createEventSchema,
	createPollSchema,
	errorSchema,
	eventDetailResponseSchema,
	eventModeSchema,
	eventSchema,
	pollOptionSchema,
	pollSchema,
	pollVoteSchema,
	sessionCreateSchema,
	slotIdSchema,
	weekdaySchema,
	weeklySlotIdSchema,
} from "./validation";

type JsonRecord = Record<string, unknown>;

function schemas(): JsonRecord {
	return getOpenApiSpec("https://example.com").components
		.schemas as unknown as JsonRecord;
}

function schemaOf(name: string): JsonRecord {
	return schemas()[name] as JsonRecord;
}

function propsOf(name: string): JsonRecord {
	return (schemaOf(name).properties ?? {}) as JsonRecord;
}

function fieldOf(schema: string, field: string): JsonRecord {
	return (propsOf(schema)[field] ?? {}) as JsonRecord;
}

function jsonOf(schema: z.ZodType): JsonRecord {
	const json = z.toJSONSchema(schema) as unknown as JsonRecord;
	if (typeof json.$ref === "string" && json.$defs !== undefined) {
		const key = (json.$ref as string).split("/").pop() as string;
		return (json.$defs as JsonRecord)[key] as JsonRecord;
	}
	return json;
}

function jsonProps(schema: z.ZodType): JsonRecord {
	return (jsonOf(schema).properties ?? {}) as JsonRecord;
}

function jsonField(schema: z.ZodType, field: string): JsonRecord {
	return (jsonProps(schema)[field] ?? {}) as JsonRecord;
}

function requiredOf(name: string): unknown {
	return schemaOf(name).required;
}

function pathRef(path: string, method: string): unknown {
	const spec = getOpenApiSpec("https://example.com");
	const paths = spec.paths as unknown as JsonRecord;
	const item = paths[path] as JsonRecord;
	const op = item[method] as JsonRecord;
	const body = op.requestBody as JsonRecord;
	const content = body.content as JsonRecord;
	const json = content["application/json"] as JsonRecord;
	return (json.schema as JsonRecord).$ref;
}

describe("openapi parity createEvent", () => {
	it("pins title times timezone dates polls weekdays", () => {
		const zodStart = jsonField(createEventSchema, "startTime");
		const zodEnd = jsonField(createEventSchema, "endTime");
		const zodDates = jsonField(createEventSchema, "dates");
		expect(fieldOf("CreateEventRequest", "title").minLength).toBe(1);
		expect(fieldOf("CreateEventRequest", "title").maxLength).toBe(100);
		expect(fieldOf("CreateEventRequest", "startTime").pattern).toBe(
			zodStart.pattern,
		);
		expect(fieldOf("CreateEventRequest", "endTime").pattern).toBe(
			zodEnd.pattern,
		);
		expect(fieldOf("CreateEventRequest", "dates").minItems).toBe(1);
		expect(fieldOf("CreateEventRequest", "dates").maxItems).toBe(31);
		expect(
			(fieldOf("CreateEventRequest", "dates").items as JsonRecord).pattern,
		).toBe((zodDates.items as JsonRecord).pattern);
		expect(fieldOf("CreateEventRequest", "polls").maxItems).toBe(10);
		expect(fieldOf("CreateEventRequest", "weekdays").maxItems).toBe(7);
		expect(fieldOf("CreateEventRequest", "timezone").minLength).toBe(1);
		expect(fieldOf("CreateEventRequest", "timezone").maxLength).toBe(64);
		expect(requiredOf("CreateEventRequest")).toEqual(
			expect.arrayContaining(["title", "startTime", "endTime", "timezone"]),
		);
		expect(requiredOf("CreateEventRequest")).not.toContain("mode");
		expect(requiredOf("CreateEventRequest")).not.toContain("dates");
	});
});

describe("openapi parity availability", () => {
	it("pins name slots password", () => {
		const zodName = jsonField(availabilitySchema, "name");
		const zodSlots = jsonField(availabilitySchema, "slots");
		expect(fieldOf("AvailabilityRequest", "name").minLength).toBe(
			zodName.minLength,
		);
		expect(fieldOf("AvailabilityRequest", "name").maxLength).toBe(
			zodName.maxLength,
		);
		expect(fieldOf("AvailabilityRequest", "slots").maxItems).toBe(
			zodSlots.maxItems,
		);
		expect(
			(fieldOf("AvailabilityRequest", "slots").items as JsonRecord).$ref,
		).toBe("#/components/schemas/SlotId");
		expect(fieldOf("AvailabilityRequest", "password").minLength).toBe(4);
		expect(fieldOf("AvailabilityRequest", "password").maxLength).toBe(72);
		expect(requiredOf("AvailabilityRequest")).toEqual(
			expect.arrayContaining(["name", "slots"]),
		);
	});
});

describe("openapi parity polls", () => {
	it("pins create poll question options", () => {
		const zodQuestion = jsonField(createPollSchema, "question");
		expect(fieldOf("CreatePollRequest", "question").minLength).toBe(1);
		expect(fieldOf("CreatePollRequest", "question").maxLength).toBe(140);
		expect(fieldOf("CreatePollRequest", "options").minItems).toBe(2);
		expect(fieldOf("CreatePollRequest", "options").maxItems).toBe(10);
		expect(
			(fieldOf("CreatePollRequest", "options").items as JsonRecord).minLength,
		).toBe(1);
		expect(
			(fieldOf("CreatePollRequest", "options").items as JsonRecord).maxLength,
		).toBe(80);
		expect(zodQuestion.maxLength).toBe(140);
		expect(requiredOf("CreatePollRequest")).toEqual(
			expect.arrayContaining(["question", "options"]),
		);
		expect(requiredOf("CreatePollRequest")).not.toContain("allowMultiple");
	});

	it("pins add option label", () => {
		const zodLabel = jsonField(addPollOptionSchema, "label");
		expect(fieldOf("AddPollOptionRequest", "label").minLength).toBe(
			zodLabel.minLength,
		);
		expect(fieldOf("AddPollOptionRequest", "label").maxLength).toBe(80);
		expect(requiredOf("AddPollOptionRequest")).toEqual(["label"]);
	});

	it("pins vote name optionIds", () => {
		const zodOptionIds = jsonField(pollVoteSchema, "optionIds");
		expect(fieldOf("PollVoteRequest", "name").minLength).toBe(1);
		expect(fieldOf("PollVoteRequest", "name").maxLength).toBe(40);
		expect(fieldOf("PollVoteRequest", "optionIds").maxItems).toBe(
			zodOptionIds.maxItems,
		);
		expect(
			(fieldOf("PollVoteRequest", "optionIds").items as JsonRecord).minLength,
		).toBe(1);
		expect(
			(fieldOf("PollVoteRequest", "optionIds").items as JsonRecord).maxLength,
		).toBe(64);
		expect(fieldOf("PollVoteRequest", "password").minLength).toBe(4);
		expect(fieldOf("PollVoteRequest", "password").maxLength).toBe(72);
		expect(requiredOf("PollVoteRequest")).toEqual(
			expect.arrayContaining(["name", "optionIds"]),
		);
	});
});

describe("openapi parity session", () => {
	it("pins name password", () => {
		const zodName = jsonField(sessionCreateSchema, "name");
		expect(fieldOf("SessionRequest", "name").minLength).toBe(zodName.minLength);
		expect(fieldOf("SessionRequest", "name").maxLength).toBe(40);
		expect(fieldOf("SessionRequest", "password").minLength).toBe(4);
		expect(fieldOf("SessionRequest", "password").maxLength).toBe(72);
		expect(requiredOf("SessionRequest")).toEqual(["name"]);
	});
});

describe("openapi parity primitives", () => {
	it("pins event mode weekday slot ids", () => {
		expect(schemaOf("EventMode").enum).toEqual(["dates", "weekly"]);
		expect(schemaOf("EventMode").enum).toEqual(jsonOf(eventModeSchema).enum);
		expect(schemaOf("Weekday").type).toBe("integer");
		expect(schemaOf("Weekday").minimum).toBe(0);
		expect(schemaOf("Weekday").maximum).toBe(6);
		expect(schemaOf("Weekday").minimum).toBe(jsonOf(weekdaySchema).minimum);
		expect(schemaOf("Weekday").maximum).toBe(jsonOf(weekdaySchema).maximum);
		expect(String(schemaOf("SlotId").pattern)).toContain("SUN|MON");
		expect(String(schemaOf("SlotId").pattern)).toContain("\\d{4}");
		expect(schemaOf("WeeklySlotId").pattern).toBe(
			"^(SUN|MON|TUE|WED|THU|FRI|SAT)-([01]\\d|2[0-3]):(00|30)$",
		);
		expect((fieldOf("CreateEventRequest", "mode") as JsonRecord).$ref).toBe(
			"#/components/schemas/EventMode",
		);
		expect(
			(fieldOf("CreateEventRequest", "weekdays").items as JsonRecord).$ref,
		).toBe("#/components/schemas/Weekday");
		expect(
			(fieldOf("CreateEventRequest", "polls").items as JsonRecord).$ref,
		).toBe("#/components/schemas/CreatePollRequest");
		expect(schemaOf("PollOption").required).toEqual(
			jsonOf(pollOptionSchema).required,
		);
	});
});

describe("openapi parity slot ids", () => {
	it("exposes SlotId and WeeklySlotId as reusable schemas", () => {
		const slotJson = jsonOf(slotIdSchema);
		const weeklyJson = jsonOf(weeklySlotIdSchema);
		expect(String(slotJson.pattern)).toContain("SUN|MON");
		expect(String(slotJson.pattern)).toContain("\\d{4}");
		expect(weeklyJson.pattern).toBe(
			"^(SUN|MON|TUE|WED|THU|FRI|SAT)-([01]\\d|2[0-3]):(00|30)$",
		);
		expect(schemaOf("SlotId").pattern).toBe(slotJson.pattern);
		expect(schemaOf("WeeklySlotId").pattern).toBe(weeklyJson.pattern);
	});

	it("validates date and weekly slots through the shared schema", () => {
		expect(slotIdSchema.safeParse("2026-10-05T09:30").success).toBe(true);
		expect(slotIdSchema.safeParse("MON-09:30").success).toBe(true);
		expect(slotIdSchema.safeParse("nope").success).toBe(false);
		expect(
			availabilitySchema.safeParse({ name: "Al", slots: ["MON-09:30"] })
				.success,
		).toBe(true);
	});
});

describe("openapi parity response registry", () => {
	it("exposes error and event detail schemas", () => {
		expect(schemaOf("Error").required).toEqual(["error"]);
		expect(schemaOf("Event").required).toContain("id");
		expect(
			(fieldOf("EventDetailResponse", "polls").items as JsonRecord).$ref,
		).toBe("#/components/schemas/Poll");
		expect(jsonOf(errorSchema)).toBeDefined();
		expect(jsonOf(eventSchema)).toBeDefined();
		expect(jsonOf(eventDetailResponseSchema)).toBeDefined();
		expect(jsonOf(pollSchema)).toBeDefined();
	});

	it("pins vote and session response shapes", () => {
		expect(schemaOf("PollVoteResponse").required).toEqual(["pollId"]);
		expect(schemaOf("SessionResponse").required).toEqual(["name"]);
		expect(schemaOf("OwnAvailabilityResponse").required).toEqual([
			"name",
			"slots",
		]);
	});
});

describe("openapi parity paths", () => {
	it("pins request bodies to zod-backed schemas", () => {
		expect(pathRef("/api/events", "post")).toBe(
			"#/components/schemas/CreateEventRequest",
		);
		expect(pathRef("/api/events/{id}/availability", "put")).toBe(
			"#/components/schemas/AvailabilityRequest",
		);
		expect(pathRef("/api/events/{id}/polls", "post")).toBe(
			"#/components/schemas/CreatePollRequest",
		);
		expect(pathRef("/api/events/{id}/polls/{pollId}/options", "post")).toBe(
			"#/components/schemas/AddPollOptionRequest",
		);
		expect(pathRef("/api/events/{id}/polls/{pollId}/vote", "put")).toBe(
			"#/components/schemas/PollVoteRequest",
		);
		expect(pathRef("/api/events/{id}/sessions", "post")).toBe(
			"#/components/schemas/SessionRequest",
		);
	});
});
