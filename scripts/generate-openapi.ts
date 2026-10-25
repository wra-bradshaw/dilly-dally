import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
} from "../src/lib/validation.ts";

function stripAnchors(source: string): string {
	return source.replace(/^\^/, "").replace(/\$$/, "");
}

function reqOf(json: any): string[] {
	const required: string[] = json.required ?? [];
	const props = json.properties ?? {};
	return required.filter((k: string) => props[k]?.default === undefined);
}

function buildSlotPattern(): string {
	return `^(${stripAnchors(slotRe.source)}|${stripAnchors(weeklySlotRe.source)})$`;
}

export function buildSpecParts() {
	const createJson: any = z.toJSONSchema(createEventSchema as any);
	const availJson: any = z.toJSONSchema(availabilitySchema as any);
	const pollJson: any = z.toJSONSchema(createPollSchema as any);
	const addOptJson: any = z.toJSONSchema(addPollOptionSchema as any);
	const voteJson: any = z.toJSONSchema(pollVoteSchema as any);
	const sessJson: any = z.toJSONSchema(sessionCreateSchema as any);
	const modeJson: any = z.toJSONSchema(eventModeSchema as any);
	const weekdayJson: any = z.toJSONSchema(weekdaySchema as any);
	return {
		addOptJson,
		availJson,
		createJson,
		modeJson,
		pollJson,
		sessJson,
		slotPattern: buildSlotPattern(),
		voteJson,
		weekdayJson,
	};
}

function ts(): string {
	const p = buildSpecParts();
	const createJson = p.createJson;
	const availJson = p.availJson;
	const pollJson = p.pollJson;
	const addOptJson = p.addOptJson;
	const voteJson = p.voteJson;
	const sessJson = p.sessJson;
	const modeEnum = JSON.stringify(p.modeJson.enum);
	const weekdayMin = p.weekdayJson.minimum;
	const weekdayMax = p.weekdayJson.maximum;
	const datePattern = dateRe.source;
	const hourPattern = hourRe.source;
	const weeklyPattern = weeklySlotRe.source;
	const slotPattern = p.slotPattern;
	const titleMin = createJson.properties.title.minLength;
	const titleMax = createJson.properties.title.maxLength;
	const tzMin = createJson.properties.timezone.minLength;
	const tzMax = createJson.properties.timezone.maxLength;
	const datesMin = createJson.properties.dates.minItems;
	const datesMax = createJson.properties.dates.maxItems;
	const pollsMax = createJson.properties.polls.maxItems;
	const weekdaysMax = createJson.properties.weekdays.maxItems;
	const availNameMin = availJson.properties.name.minLength;
	const availNameMax = availJson.properties.name.maxLength;
	const slotsMax = availJson.properties.slots.maxItems;
	const pwdMin = availJson.properties.password.minLength;
	const pwdMax = availJson.properties.password.maxLength;
	const qMin = pollJson.properties.question.minLength;
	const qMax = pollJson.properties.question.maxLength;
	const optsMin = pollJson.properties.options.minItems;
	const optsMax = pollJson.properties.options.maxItems;
	const optItemMin = pollJson.properties.options.items.minLength;
	const optItemMax = pollJson.properties.options.items.maxLength;
	const labelMin = addOptJson.properties.label.minLength;
	const labelMax = addOptJson.properties.label.maxLength;
	const voteOptMax = voteJson.properties.optionIds.maxItems;
	const voteOptItemMin = voteJson.properties.optionIds.items.minLength;
	const voteOptItemMax = voteJson.properties.optionIds.items.maxLength;
	const sessNameMin = sessJson.properties.name.minLength;
	const sessNameMax = sessJson.properties.name.maxLength;
	const createRequired = JSON.stringify(reqOf(createJson));
	const lines: string[] = [];
	lines.push("// @generated");
	lines.push('import { docsResponse, originOf } from "./api-errors";');
	lines.push("");
	lines.push("interface OpenApiSchema {");
	lines.push("\t$ref?: string;");
	lines.push("\tadditionalProperties?: OpenApiSchema | boolean;");
	lines.push("\tdescription?: string;");
	lines.push("\tenum?: string[];");
	lines.push("\texample?: unknown;");
	lines.push("\tformat?: string;");
	lines.push("\titems?: OpenApiSchema;");
	lines.push("\tmaxItems?: number;");
	lines.push("\tmaxLength?: number;");
	lines.push("\tminItems?: number;");
	lines.push("\tminLength?: number;");
	lines.push("\tminimum?: number;");
	lines.push("\tmaximum?: number;");
	lines.push("\tnullable?: boolean;");
	lines.push("\tpattern?: string;");
	lines.push("\tproperties?: Record<string, OpenApiSchema>;");
	lines.push("\trequired?: string[];");
	lines.push("\ttype?: string;");
	lines.push("}");
	lines.push("");
	lines.push("export interface OpenApiSpec {");
	lines.push("\tcomponents: {");
	lines.push("\t\tschemas: Record<string, OpenApiSchema>;");
	lines.push("\t};");
	lines.push(
		"\tinfo: { title: string; version: string; description: string };",
	);
	lines.push("\topenapi: string;");
	lines.push("\tpaths: Record<string, unknown>;");
	lines.push('\tservers: { url: string }[];');
	lines.push("}");
	lines.push("");
	lines.push("export function serializeSpec(spec: OpenApiSpec): string {");
	lines.push('\treturn `${JSON.stringify(spec, null, 2)}\\n`;');
	lines.push("}");
	lines.push("");
	lines.push("export function openApiResponse(request: Request): Response {");
	lines.push("\treturn docsResponse(");
	lines.push("\t\tJSON.stringify(getOpenApiSpec(originOf(request))),");
	lines.push('\t\t"application/json; charset=utf-8",');
	lines.push("\t);");
	lines.push("}");
	lines.push("");
	lines.push("export function getOpenApiSpec(origin: string): OpenApiSpec {");
	lines.push("\tconst slotId: OpenApiSchema = {");
	lines.push(
		'\t\tdescription: "Slot id in event-timezone wall time. Date events use YYYY-MM-DDTHH:mm; weekly events use DOW-HH:mm like MON-09:30.",',
	);
	lines.push(`\t\texample: "2026-10-05T09:30",`);
	lines.push(`\t\tpattern: ${JSON.stringify(slotPattern)},`);
	lines.push('\t\ttype: "string",');
	lines.push("\t};");
	lines.push("\tconst weeklySlotId: OpenApiSchema = {");
	lines.push(
		'\t\tdescription: "Weekly slot id: weekday code plus HH:mm. Monday is MON, Sunday is SUN.",',
	);
	lines.push('\t\texample: "MON-09:30",');
	lines.push(`\t\tpattern: ${JSON.stringify(weeklyPattern)},`);
	lines.push('\t\ttype: "string",');
	lines.push("\t};");
	lines.push("\treturn {");
	lines.push("\t\tcomponents: {");
	lines.push("\t\t\tschemas: {");
	lines.push("\t\t\t\tAvailabilityRequest: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push(
		`\t\t\t\t\t\tname: { maxLength: ${availNameMax}, minLength: ${availNameMin}, type: "string" },`,
	);
	lines.push("\t\t\t\t\t\tpassword: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Optional password. Sent only over HTTPS, never stored in plain text.",',
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxLength: ${pwdMax}, minLength: ${pwdMin}, type: "string",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\tslots: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Full replace set of slot ids. Date events use YYYY-MM-DDTHH:mm; weekly events use DOW-HH:mm like MON-09:30. Empty array means unavailable everywhere.",',
	);
	lines.push(
		'\t\t\t\t\t\t\titems: { $ref: "#/components/schemas/SlotId" },',
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxItems: ${slotsMax}, type: "array",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["name", "slots"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tAvailabilityResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tcount: { type: "integer" },');
	lines.push('\t\t\t\t\t\tname: { type: "string" },');
	lines.push('\t\t\t\t\t\tprotected: { type: "boolean" },');
	lines.push('\t\t\t\t\t\tupdatedAt: { type: "string" },');
	lines.push("\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\trequired: ["name", "count", "protected", "updatedAt"],',
	);
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tCreateEventRequest: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push("\t\t\t\t\t\tdates: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "1..31 entries, YYYY-MM-DD, each today (UTC) through today+90 inclusive. Required when mode is dates (the default). Omit or send [] for weekly events.",',
	);
	lines.push(
		`\t\t\t\t\t\t\titems: { pattern: ${JSON.stringify(datePattern)}, type: "string" },`,
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxItems: ${datesMax}, minItems: ${datesMin}, type: "array",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\tendTime: {");
	lines.push('\t\t\t\t\t\t\texample: "17:00",');
	lines.push(
		`\t\t\t\t\t\t\tpattern: ${JSON.stringify(hourPattern)}, type: "string",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\tmode: { $ref: "#/components/schemas/EventMode" },',
	);
	lines.push("\t\t\t\t\t\tpolls: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Optional 0..10 polls created with the event. Each needs question 1..140 chars and 2..10 unique options 1..80 chars.",',
	);
	lines.push(
		'\t\t\t\t\t\t\titems: { $ref: "#/components/schemas/CreatePollRequest" },',
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxItems: ${pollsMax}, type: "array",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\tstartTime: {");
	lines.push('\t\t\t\t\t\t\texample: "09:00",');
	lines.push(
		`\t\t\t\t\t\t\tpattern: ${JSON.stringify(hourPattern)}, type: "string",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push(
		`\t\t\t\t\t\ttimezone: { example: "America/New_York", maxLength: ${tzMax}, minLength: ${tzMin}, type: "string" },`,
	);
	lines.push(
		`\t\t\t\t\t\ttitle: { maxLength: ${titleMax}, minLength: ${titleMin}, type: "string" },`,
	);
	lines.push("\t\t\t\t\t\tweekdays: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Required when mode is weekly. 1..7 unique entries, 0=Sunday through 6=Saturday. Example [1,3,5] means Mon/Wed/Fri.",',
	);
	lines.push(
		'\t\t\t\t\t\t\titems: { $ref: "#/components/schemas/Weekday" },',
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxItems: ${weekdaysMax}, type: "array",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push(`\t\t\t\t\trequired: ${createRequired},`);
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tCreatePollRequest: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push("\t\t\t\t\t\tallowMultiple: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "When true voters may pick multiple options, otherwise single choice.",',
	);
	lines.push('\t\t\t\t\t\t\ttype: "boolean",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\toptions: {");
	lines.push(
		`\t\t\t\t\t\t\titems: { maxLength: ${optItemMax}, minLength: ${optItemMin}, type: "string" },`,
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxItems: ${optsMax}, minItems: ${optsMin}, type: "array",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push(
		`\t\t\t\t\t\tquestion: { maxLength: ${qMax}, minLength: ${qMin}, type: "string" },`,
	);
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["question", "options"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tPollOption: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tcount: { type: "integer" },');
	lines.push('\t\t\t\t\t\tid: { type: "string" },');
	lines.push('\t\t\t\t\t\tlabel: { type: "string" },');
	lines.push(
		'\t\t\t\t\t\tnames: { items: { type: "string" }, type: "array" },',
	);
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["id", "label", "count", "names"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tPoll: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tallowMultiple: { type: "boolean" },');
	lines.push('\t\t\t\t\t\tid: { type: "string" },');
	lines.push("\t\t\t\t\t\toptions: {");
	lines.push(
		'\t\t\t\t\t\t\titems: { $ref: "#/components/schemas/PollOption" },',
	);
	lines.push('\t\t\t\t\t\t\ttype: "array",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\tquestion: { type: "string" },');
	lines.push('\t\t\t\t\t\ttotalVoters: { type: "integer" },');
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\trequired: [");
	lines.push('\t\t\t\t\t\t"id",');
	lines.push('\t\t\t\t\t\t"question",');
	lines.push('\t\t\t\t\t\t"allowMultiple",');
	lines.push('\t\t\t\t\t\t"options",');
	lines.push('\t\t\t\t\t\t"totalVoters",');
	lines.push("\t\t\t\t\t],");
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tCreatePollResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push(
		'\t\t\t\t\t\tpoll: { $ref: "#/components/schemas/Poll" },',
	);
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["poll"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tAddPollOptionRequest: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push(
		`\t\t\t\t\t\tlabel: { maxLength: ${labelMax}, minLength: ${labelMin}, type: "string" },`,
	);
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["label"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tAddPollOptionResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tid: { type: "string" },');
	lines.push('\t\t\t\t\t\tlabel: { type: "string" },');
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["id", "label"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tPollVoteRequest: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push(
		`\t\t\t\t\t\tname: { maxLength: ${availNameMax}, minLength: ${availNameMin}, type: "string" },`,
	);
	lines.push("\t\t\t\t\t\toptionIds: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Full replace set of option ids for this poll. Empty array clears the vote.",',
	);
	lines.push(
		`\t\t\t\t\t\t\titems: { maxLength: ${voteOptItemMax}, minLength: ${voteOptItemMin}, type: "string" },`,
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxItems: ${voteOptMax}, type: "array",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\tpassword: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Optional password, same identity as availability. Required when the name is password-protected.",',
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxLength: ${pwdMax}, minLength: ${pwdMin}, type: "string",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["name", "optionIds"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tPollVoteResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tpollId: { type: "string" },');
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["pollId"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tEventMode: {");
	lines.push(
		'\t\t\t\t\tdescription: "dates picks specific dates; weekly repeats on weekdays.",',
	);
	lines.push(`\t\t\t\t\tenum: ${modeEnum},`);
	lines.push('\t\t\t\t\texample: "dates",');
	lines.push('\t\t\t\t\ttype: "string",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tWeekday: {");
	lines.push(
		'\t\t\t\t\tdescription: "Day of week, 0=Sunday through 6=Saturday.",',
	);
	lines.push("\t\t\t\t\texample: 1,");
	lines.push(`\t\t\t\t\tmaximum: ${weekdayMax},`);
	lines.push(`\t\t\t\t\tminimum: ${weekdayMin},`);
	lines.push('\t\t\t\t\ttype: "integer",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tWeeklySlotId: weeklySlotId,");
	lines.push("\t\t\t\tCreateEventResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push(
		'\t\t\t\t\t\tevent: { $ref: "#/components/schemas/Event" },',
	);
	lines.push('\t\t\t\t\t\tid: { type: "string" },');
	lines.push('\t\t\t\t\t\turl: { type: "string" },');
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["id", "url", "event"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tError: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push("\t\t\t\t\t\terror: {");
	lines.push("\t\t\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\t\t\tcode: { type: "string" },');
	lines.push("\t\t\t\t\t\t\t\tfields: {");
	lines.push("\t\t\t\t\t\t\t\t\tadditionalProperties: {");
	lines.push(
		'\t\t\t\t\t\t\t\t\t\titems: { type: "string" },',
	);
	lines.push('\t\t\t\t\t\t\t\t\t\ttype: "array",');
	lines.push("\t\t\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\t\tmessage: { type: "string" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\trequired: ["code", "message"],',
	);
	lines.push('\t\t\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["error"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tEvent: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tcreatedAt: { type: "string" },');
	lines.push("\t\t\t\t\t\tdates: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Specific dates for dates events; empty array for weekly events.",',
	);
	lines.push(
		'\t\t\t\t\t\t\titems: { type: "string" }, type: "array",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\tendTime: { type: "string" },');
	lines.push('\t\t\t\t\t\texpiresAt: { type: "string" },');
	lines.push('\t\t\t\t\t\tid: { type: "string" },');
	lines.push(
		'\t\t\t\t\t\tmode: { $ref: "#/components/schemas/EventMode" },',
	);
	lines.push('\t\t\t\t\t\tstartTime: { type: "string" },');
	lines.push('\t\t\t\t\t\ttimezone: { type: "string" },');
	lines.push('\t\t\t\t\t\ttitle: { type: "string" },');
	lines.push("\t\t\t\t\t\tweekdays: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Weekdays for weekly events, 0=Sunday through 6=Saturday; empty array for dates events.",',
	);
	lines.push(
		'\t\t\t\t\t\t\titems: { $ref: "#/components/schemas/Weekday" },',
	);
	lines.push('\t\t\t\t\t\t\ttype: "array",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\trequired: [");
	lines.push('\t\t\t\t\t\t"id",');
	lines.push('\t\t\t\t\t\t"title",');
	lines.push('\t\t\t\t\t\t"mode",');
	lines.push('\t\t\t\t\t\t"dates",');
	lines.push('\t\t\t\t\t\t"weekdays",');
	lines.push('\t\t\t\t\t\t"startTime",');
	lines.push('\t\t\t\t\t\t"endTime",');
	lines.push('\t\t\t\t\t\t"timezone",');
	lines.push('\t\t\t\t\t\t"createdAt",');
	lines.push('\t\t\t\t\t\t"expiresAt",');
	lines.push("\t\t\t\t\t],");
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tSlotId: slotId,");
	lines.push("\t\t\t\tEventDetailResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push("\t\t\t\t\t\tbestTimes: {");
	lines.push("\t\t\t\t\t\t\titems: {");
	lines.push("\t\t\t\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\t\t\t\tcount: { type: "integer" },');
	lines.push('\t\t\t\t\t\t\t\t\tslot: { type: "string" },');
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\t\trequired: ["slot", "count"],',
	);
	lines.push('\t\t\t\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\ttype: "array",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\tcounts: {");
	lines.push("\t\t\t\t\t\t\titems: {");
	lines.push("\t\t\t\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\t\t\t\tcount: { type: "integer" },');
	lines.push(
		'\t\t\t\t\t\t\t\t\tnames: { items: { type: "string" }, type: "array" },',
	);
	lines.push('\t\t\t\t\t\t\t\t\tslot: { type: "string" },');
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\t\trequired: ["slot", "count", "names"],',
	);
	lines.push('\t\t\t\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\ttype: "array",');
	lines.push("\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\tevent: { $ref: "#/components/schemas/Event" },',
	);
	lines.push("\t\t\t\t\t\tparticipants: {");
	lines.push("\t\t\t\t\t\t\titems: {");
	lines.push("\t\t\t\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\t\t\t\tcount: { type: "integer" },');
	lines.push('\t\t\t\t\t\t\t\t\tname: { type: "string" },');
	lines.push(
		'\t\t\t\t\t\t\t\t\tupdatedAt: { type: "string" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\t\trequired: ["name", "count", "updatedAt"],',
	);
	lines.push('\t\t\t\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\ttype: "array",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\tpolls: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Polls for this event, each with public vote counts and voter names.",',
	);
	lines.push(
		'\t\t\t\t\t\t\titems: { $ref: "#/components/schemas/Poll" },',
	);
	lines.push('\t\t\t\t\t\t\ttype: "array",');
	lines.push("\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\tslotUniverse: { items: { type: "string" }, type: "array" },',
	);
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\trequired: [");
	lines.push('\t\t\t\t\t\t"event",');
	lines.push('\t\t\t\t\t\t"slotUniverse",');
	lines.push('\t\t\t\t\t\t"counts",');
	lines.push('\t\t\t\t\t\t"participants",');
	lines.push('\t\t\t\t\t\t"bestTimes",');
	lines.push('\t\t\t\t\t\t"polls",');
	lines.push("\t\t\t\t\t],");
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tOwnAvailabilityResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tname: { type: "string" },');
	lines.push(
		'\t\t\t\t\t\tslots: { items: { type: "string" }, type: "array" },',
	);
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["name", "slots"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tSessionRequest: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push(
		`\t\t\t\t\t\tname: { maxLength: ${sessNameMax}, minLength: ${sessNameMin}, type: "string" },`,
	);
	lines.push("\t\t\t\t\t\tpassword: {");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Optional password, required when the name is password-protected. Never stored, only used to mint a short-lived session cookie.",',
	);
	lines.push(
		`\t\t\t\t\t\t\tmaxLength: ${pwdMax}, minLength: ${pwdMin}, type: "string",`,
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["name"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tSessionResponse: {");
	lines.push("\t\t\t\t\tproperties: {");
	lines.push('\t\t\t\t\t\tname: { type: "string" },');
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\trequired: ["name"],');
	lines.push('\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push("\t\t},");
	lines.push("\t\tinfo: {");
	lines.push(
		'\t\t\tdescription: "Agent-friendly when2meet replacement. Create events with curl, then add availability by name.",',
	);
	lines.push('\t\t\ttitle: "Dilly-Dally API",');
	lines.push('\t\t\tversion: "1.0.0",');
	lines.push("\t\t},");
	lines.push('\t\topenapi: "3.1.0",');
	lines.push("\t\tpaths: {");
	lines.push('\t\t\t"/api/events": {');
	lines.push("\t\t\t\tpost: {");
	lines.push('\t\t\t\t\toperationId: "createEvent",');
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/CreateEventRequest" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"201": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/CreateEventResponse" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Event created",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"413": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Payload too large",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"415": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Content-Type must be application/json",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"500": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Internal error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Create an event",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push('\t\t\t"/api/events/{id}": {');
	lines.push("\t\t\t\tget: {");
	lines.push('\t\t\t\t\toperationId: "getEvent",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push("\t\t\t\t\t\t\t\t\tschema: {");
	lines.push(
		'\t\t\t\t\t\t\t\t\t\t$ref: "#/components/schemas/EventDetailResponse",',
	);
	lines.push("\t\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Event with counts and participants",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Get event and group availability",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push('\t\t\t"/api/events/{id}/availability": {');
	lines.push("\t\t\t\tget: {");
	lines.push('\t\t\t\t\toperationId: "getAvailability",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "query",');
	lines.push('\t\t\t\t\t\t\tname: "name",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push("\t\t\t\t\t\t\t\t\tschema: {");
	lines.push(
		'\t\t\t\t\t\t\t\t\t\t$ref: "#/components/schemas/OwnAvailabilityResponse",',
	);
	lines.push("\t\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Own slots for editing",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"401": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid password",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Event not found, or no availability for this name (availability_not_found)",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Get own availability",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tput: {");
	lines.push('\t\t\t\t\toperationId: "putAvailability",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/AvailabilityRequest" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/AvailabilityResponse" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Saved",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"401": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid password",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"413": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Payload too large",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"415": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Content-Type must be application/json",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"422": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid slot",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Create or update availability",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tpost: {");
	lines.push('\t\t\t\t\toperationId: "postAvailability",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/AvailabilityRequest" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/AvailabilityResponse" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Saved",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"401": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid password",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"413": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Payload too large",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"415": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Content-Type must be application/json",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"422": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid slot",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Create or update availability (alias of PUT)",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push('\t\t\t"/api/events/{id}/polls": {');
	lines.push("\t\t\t\tpost: {");
	lines.push('\t\t\t\t\toperationId: "createPoll",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/CreatePollRequest" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"201": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push("\t\t\t\t\t\t\t\t\tschema: {");
	lines.push(
		'\t\t\t\t\t\t\t\t\t\t$ref: "#/components/schemas/CreatePollResponse",',
	);
	lines.push("\t\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Poll created",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"409": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Duplicate or too many polls",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Add a poll to an event",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push('\t\t\t"/api/events/{id}/polls/{pollId}/options": {');
	lines.push("\t\t\t\tpost: {");
	lines.push('\t\t\t\t\toperationId: "addPollOption",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "pollId",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push("\t\t\t\t\t\t\t\tschema: {");
	lines.push(
		'\t\t\t\t\t\t\t\t\t$ref: "#/components/schemas/AddPollOptionRequest",',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"201": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push("\t\t\t\t\t\t\t\t\tschema: {");
	lines.push(
		'\t\t\t\t\t\t\t\t\t\t$ref: "#/components/schemas/AddPollOptionResponse",',
	);
	lines.push("\t\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Option added",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"409": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Duplicate or too many options",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Add an option to a poll",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push('\t\t\t"/api/events/{id}/polls/{pollId}/options/{optionId}": {');
	lines.push("\t\t\t\tdelete: {");
	lines.push('\t\t\t\t\toperationId: "deletePollOption",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "pollId",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "optionId",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push("\t\t\t\t\t\t\t\t\tschema: {");
	lines.push('\t\t\t\t\t\t\t\t\t\tadditionalProperties: true,');
	lines.push('\t\t\t\t\t\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Deleted",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"409": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Option has votes and cannot be removed",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Remove an unvoted poll option",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push('\t\t\t"/api/events/{id}/polls/{pollId}/vote": {');
	lines.push("\t\t\t\tput: {");
	lines.push('\t\t\t\t\toperationId: "putPollVote",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "pollId",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/PollVoteRequest" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/PollVoteResponse" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Vote saved",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"401": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid password",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"422": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Invalid option or selection",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Vote in a poll",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tpost: {");
	lines.push('\t\t\t\t\toperationId: "postPollVote",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "pollId",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/PollVoteRequest" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/PollVoteResponse" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Vote saved",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"401": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid password",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"404": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Not found",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"410": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Expired",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"422": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Invalid option or selection",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"429": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Rate limited",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Vote in a poll (alias of PUT)",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push('\t\t\t"/api/events/{id}/sessions": {');
	lines.push("\t\t\t\tpost: {");
	lines.push('\t\t\t\t\toperationId: "createSession",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\trequestBody: {");
	lines.push("\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/SessionRequest" },',
	);
	lines.push("\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\trequired: true,");
	lines.push("\t\t\t\t\t},");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"201": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/SessionResponse" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push(
		'\t\t\t\t\t\t\tdescription: "Session created, HttpOnly session cookie set",',
	);
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"400": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Validation error",');
	lines.push("\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t"401": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push(
		'\t\t\t\t\t\t\t\t\tschema: { $ref: "#/components/schemas/Error" },',
	);
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Invalid password",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Create an event session",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t\tdelete: {");
	lines.push('\t\t\t\t\toperationId: "deleteSession",');
	lines.push("\t\t\t\t\tparameters: [");
	lines.push("\t\t\t\t\t\t{");
	lines.push('\t\t\t\t\t\t\tin: "path",');
	lines.push('\t\t\t\t\t\t\tname: "id",');
	lines.push("\t\t\t\t\t\t\trequired: true,");
	lines.push('\t\t\t\t\t\t\tschema: { type: "string" },');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t],");
	lines.push("\t\t\t\t\tresponses: {");
	lines.push('\t\t\t\t\t\t"200": {');
	lines.push("\t\t\t\t\t\t\tcontent: {");
	lines.push('\t\t\t\t\t\t\t\t"application/json": {');
	lines.push("\t\t\t\t\t\t\t\t\tschema: {");
	lines.push('\t\t\t\t\t\t\t\t\t\tadditionalProperties: true,');
	lines.push('\t\t\t\t\t\t\t\t\t\ttype: "object",');
	lines.push("\t\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t\t\t},");
	lines.push('\t\t\t\t\t\t\tdescription: "Session cleared",');
	lines.push("\t\t\t\t\t\t},");
	lines.push("\t\t\t\t\t},");
	lines.push('\t\t\t\t\tsummary: "Clear an event session",');
	lines.push("\t\t\t\t},");
	lines.push("\t\t\t},");
	lines.push("\t\t},");
	lines.push("\t\tservers: [{ url: origin }],");
	lines.push("\t};");
	lines.push("}");
	lines.push("");
	return `${lines.join("\n")}\n`;
}

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "src", "lib", "openapi.ts");
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	writeFileSync(outPath, ts());
	console.log(`wrote ${outPath}`);
}
