import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import type { DillyEvent, DrizzleDb } from "./db";
import { upsertAvailability } from "./server-availability";
import { getEventDetail, loadLiveEvent } from "./server-event-detail";
import { createEventInDb, toEventDto } from "./server-events";
import { createPollInDb, votePollInDb } from "./server-polls";
import {
	availabilitySchema,
	createEventSchema,
	createPollSchema,
	pollVoteSchema,
} from "./validation";

const SERVER_INFO = {
	name: "dilly-dally",
	version: "1.0.0",
} as const;

const INSTRUCTIONS =
	"Dilly-dally finds group meeting times and polls. Create events, share availability, create polls and vote.";

const BASE_ANNOTATIONS = {
	destructiveHint: false,
	openWorldHint: false,
} as const;

const eventIdField = z.string().regex(/^[A-Za-z0-9_-]{12}$/);
const pollIdField = z.string().min(1).max(64);

const getEventInput = z.object({ eventId: eventIdField });
const saveAvailabilityInput = availabilitySchema.extend({
	eventId: eventIdField,
});
const createPollInput = createPollSchema.extend({ eventId: eventIdField });
const votePollInput = pollVoteSchema.extend({
	eventId: eventIdField,
	pollId: pollIdField,
});

export const MCP_TOOL_DEFS = {
	create_event: {
		annotations: {
			...BASE_ANNOTATIONS,
			idempotentHint: false,
			readOnlyHint: false,
			title: "Create event",
		},
		description: "Create an event",
		inputSchema: createEventSchema,
	},
	create_poll: {
		annotations: {
			...BASE_ANNOTATIONS,
			idempotentHint: false,
			readOnlyHint: false,
			title: "Create poll",
		},
		description: "Add a poll to an event",
		inputSchema: createPollInput,
	},
	get_event: {
		annotations: {
			...BASE_ANNOTATIONS,
			idempotentHint: true,
			readOnlyHint: true,
			title: "Get event",
		},
		description: "Get event and group availability",
		inputSchema: getEventInput,
	},
	save_availability: {
		annotations: {
			...BASE_ANNOTATIONS,
			idempotentHint: true,
			readOnlyHint: false,
			title: "Save availability",
		},
		description: "Create or update availability",
		inputSchema: saveAvailabilityInput,
	},
	vote_poll: {
		annotations: {
			...BASE_ANNOTATIONS,
			idempotentHint: true,
			readOnlyHint: false,
			title: "Vote in poll",
		},
		description: "Vote in a poll",
		inputSchema: votePollInput,
	},
};

async function requireLiveEvent(
	db: DrizzleDb,
	eventId: string,
): Promise<DillyEvent> {
	const loaded = await loadLiveEvent(db, eventId, Date.now());
	if (!loaded.ok)
		throw new Error(
			loaded.code === "gone" ? "Event no longer available" : "Event not found",
		);
	return loaded.event;
}

function toolResult(result: Record<string, unknown>) {
	return {
		content: [{ text: JSON.stringify(result), type: "text" as const }],
		structuredContent: result,
	};
}

async function handleCreateEvent(
	db: DrizzleDb,
	args: z.infer<typeof createEventSchema>,
	origin: string,
) {
	const created = await createEventInDb(db, args, Date.now());
	if (!created) throw new Error("Could not create event");
	const baseOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
	return toolResult({
		event: toEventDto(created),
		id: created.id,
		url: `${baseOrigin}/e/${created.id}`,
	});
}

async function handleCreatePoll(
	db: DrizzleDb,
	args: z.infer<typeof createPollInput>,
	_origin: string,
) {
	const parsed = createPollSchema.safeParse({
		allowMultiple: args.allowMultiple,
		options: args.options,
		question: args.question,
	});
	if (!parsed.success) throw new Error(`Invalid poll: ${parsed.error.message}`);
	const event = await requireLiveEvent(db, args.eventId);
	const created = await createPollInDb(db, event.id, parsed.data, Date.now());
	if (!created.ok) {
		if (created.code === "too_many_polls")
			throw new Error("This event already has 10 polls");
		if (created.code === "duplicate_question")
			throw new Error("A poll with this question already exists");
		if (created.code === "duplicate_option")
			throw new Error("Poll options must be unique");
		throw new Error("Could not create poll");
	}
	return toolResult({ poll: created.poll });
}

async function handleGetEvent(
	db: DrizzleDb,
	args: z.infer<typeof getEventInput>,
	_origin: string,
) {
	const event = await requireLiveEvent(db, args.eventId);
	const detail = await getEventDetail(db, event);
	return toolResult(detail as Record<string, unknown>);
}

async function handleSaveAvailability(
	db: DrizzleDb,
	args: z.infer<typeof saveAvailabilityInput>,
	_origin: string,
) {
	const parsed = availabilitySchema.safeParse({
		name: args.name,
		password: args.password,
		slots: args.slots,
	});
	if (!parsed.success)
		throw new Error(`Invalid availability: ${parsed.error.message}`);
	const event = await requireLiveEvent(db, args.eventId);
	const saved = await upsertAvailability(db, event, parsed.data, Date.now());
	if (!saved.ok) {
		if (saved.code === "invalid_slot")
			throw new Error("One or more slots are outside the event");
		throw new Error("Wrong password for this name");
	}
	return toolResult({
		count: saved.result.count,
		name: saved.result.name,
		protected: saved.result.protected,
		updatedAt: new Date(saved.result.updatedAt).toISOString(),
	});
}

async function handleVotePoll(
	db: DrizzleDb,
	args: z.infer<typeof votePollInput>,
	_origin: string,
) {
	const parsed = pollVoteSchema.safeParse({
		name: args.name,
		optionIds: args.optionIds,
		password: args.password,
	});
	if (!parsed.success) throw new Error(`Invalid vote: ${parsed.error.message}`);
	const event = await requireLiveEvent(db, args.eventId);
	const voted = await votePollInDb(
		db,
		event,
		args.pollId,
		parsed.data,
		Date.now(),
	);
	if (!voted.ok) {
		if (voted.code === "not_found") throw new Error("Poll not found");
		if (voted.code === "invalid_password")
			throw new Error("Wrong password for this name");
		if (voted.code === "invalid_option" || voted.code === "invalid_selection")
			throw new Error("Invalid poll selection");
		throw new Error("Could not save vote");
	}
	return toolResult({ pollId: args.pollId });
}

export function buildMcpServer(db: DrizzleDb, origin: string): McpServer {
	const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
	server.registerTool("create_event", MCP_TOOL_DEFS.create_event, (args) =>
		handleCreateEvent(db, args, origin),
	);
	server.registerTool("create_poll", MCP_TOOL_DEFS.create_poll, (args) =>
		handleCreatePoll(db, args, origin),
	);
	server.registerTool("get_event", MCP_TOOL_DEFS.get_event, (args) =>
		handleGetEvent(db, args, origin),
	);
	server.registerTool(
		"save_availability",
		MCP_TOOL_DEFS.save_availability,
		(args) => handleSaveAvailability(db, args, origin),
	);
	server.registerTool("vote_poll", MCP_TOOL_DEFS.vote_poll, (args) =>
		handleVotePoll(db, args, origin),
	);
	return server;
}

export function createSdkMcpHandler(
	db: DrizzleDb,
	origin: string,
): (req: Request) => Promise<Response> {
	const handler = createMcpHandler(() => buildMcpServer(db, origin));
	return (req: Request) => handler.fetch(req);
}
