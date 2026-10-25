import { describe, expect, it } from "vitest";
import type { DrizzleDb } from "./db";
import { buildMcpServer, createSdkMcpHandler, MCP_TOOL_DEFS } from "./mcp-sdk";
import * as schema from "./schema";
import { createTestDb } from "./test-db";

function chainable(rows: unknown) {
	const proxy = new Proxy(() => {}, {
		apply() {
			return proxy;
		},
		get(_target, prop) {
			if (prop === "then") {
				return (resolve: (value: unknown) => void) => {
					resolve(rows);
				};
			}
			return (..._args: unknown[]) => proxy;
		},
	});
	return proxy;
}

function stubDb(eventRows: unknown[] = []) {
	return {
		delete: () => ({ where: () => Promise.resolve() }),
		insert: () => ({ values: () => Promise.resolve() }),
		select: () => ({
			from: (table: unknown) =>
				table === schema.events ? chainable(eventRows) : chainable([]),
		}),
		update: () => chainable([]),
	} as unknown as DrizzleDb;
}

function eventRow(overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	return {
		createdAt: now - 1000,
		datesJson: JSON.stringify([new Date().toISOString().slice(0, 10)]),
		endTime: "10:00",
		expiresAt: now + 3600000,
		id: "abcdefghijkl",
		mode: "dates",
		startTime: "09:00",
		timezone: "America/New_York",
		title: "Team sync",
		weekdaysJson: JSON.stringify([]),
		...overrides,
	};
}

type RpcBody = {
	error?: { code: number; message: string };
	id: number | string;
	jsonrpc: string;
	result?: {
		content: Array<{ text: string; type: string }>;
		isError?: boolean;
		structuredContent?: unknown;
		tools?: Array<{
			description?: string;
			inputSchema?: Record<string, unknown>;
			name: string;
		}>;
	};
};

async function postRpc(
	handler: (req: Request) => Promise<Response>,
	method: string,
	params: unknown,
	id: number | string = 1,
): Promise<{ body: RpcBody; response: Response }> {
	const response = await handler(
		new Request("https://example.com/mcp", {
			body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
			headers: {
				accept: "application/json, text/event-stream",
				"content-type": "application/json",
			},
			method: "POST",
		}),
	);
	const text = await response.text();
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("text/event-stream")) {
		const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
		if (!dataLine) throw new Error(`SSE response without data frame: ${text}`);
		return { body: JSON.parse(dataLine.slice(6)) as RpcBody, response };
	}
	return { body: JSON.parse(text) as RpcBody, response };
}

async function callTool(
	handler: (req: Request) => Promise<Response>,
	name: string,
	args: unknown,
) {
	const { body } = await postRpc(handler, "tools/call", {
		arguments: args,
		name,
	});
	return body.result;
}

function handlerWith(eventRows: unknown[] = []) {
	return createSdkMcpHandler(stubDb(eventRows), "https://example.com");
}

async function expectToolError(
	handler: (req: Request) => Promise<Response>,
	name: string,
	args: unknown,
	message: string,
) {
	const result = await callTool(handler, name, args);
	expect(result?.isError).toBe(true);
	expect(JSON.stringify(result?.content ?? "")).toContain(message);
}

function todayDate(): string {
	return new Date().toISOString().slice(0, 10);
}

function structuredRecord(result: unknown): Record<string, unknown> {
	const structured = (result as { structuredContent?: unknown })
		?.structuredContent;
	expect(structured).toBeDefined();
	return structured as Record<string, unknown>;
}

async function createRealEvent(
	handler: (req: Request) => Promise<Response>,
	title = "Team sync",
): Promise<string> {
	const result = await callTool(handler, "create_event", {
		dates: [todayDate()],
		endTime: "10:00",
		startTime: "09:00",
		timezone: "America/New_York",
		title,
	});
	expect(result?.isError).toBeFalsy();
	const record = structuredRecord(result);
	expect(typeof record.id).toBe("string");
	return record.id as string;
}

describe("sdk tool catalog", () => {
	it("exposes five alphabetical tools with object schemas", () => {
		const names = Object.keys(MCP_TOOL_DEFS);
		expect(names).toEqual([
			"create_event",
			"create_poll",
			"get_event",
			"save_availability",
			"vote_poll",
		]);
		expect([...names].sort()).toEqual(names);
		const server = buildMcpServer(stubDb(), "https://example.com");
		for (const name of names) {
			const def = MCP_TOOL_DEFS[name as keyof typeof MCP_TOOL_DEFS];
			expect(def.description.length).toBeGreaterThan(0);
			const input = server.toolInputSchemaJson(name);
			expect(input).toBeDefined();
			expect((input as { type?: string }).type).toBe("object");
		}
		expect(server.toolInputSchemaJson("no_such_tool")).toBeUndefined();
	});

	it("advertises zod-derived required fields for create_event", () => {
		const server = buildMcpServer(stubDb(), "https://example.com");
		const input = server.toolInputSchemaJson("create_event") as {
			$defs?: Record<string, { required?: string[] }>;
			$ref?: string;
		};
		expect(input.$ref).toBe("#/$defs/CreateEventRequest");
		expect(input.$defs?.CreateEventRequest?.required).toEqual(
			expect.arrayContaining(["title", "startTime", "endTime", "timezone"]),
		);
	});
});

describe("sdk handler tools/list", () => {
	it("serves sorted tools with descriptions and object schemas", async () => {
		const { body, response } = await postRpc(handlerWith(), "tools/list", {});
		expect(response.status).toBe(200);
		const names = (body.result?.tools ?? []).map((tool) => tool.name);
		expect(names).toEqual(Object.keys(MCP_TOOL_DEFS));
		for (const tool of body.result?.tools ?? []) {
			expect(tool.description?.length ?? 0).toBeGreaterThan(0);
			expect(tool.inputSchema?.type).toBe("object");
		}
	});
});

describe("sdk handler tools/call", () => {
	it("rejects invalid create_event input via zod validation", async () => {
		await expectToolError(
			handlerWith(),
			"create_event",
			{
				endTime: "10:00",
				startTime: "09:00",
				timezone: "America/New_York",
			},
			"title",
		);
	});

	it("maps a missing event to a not found error", async () => {
		await expectToolError(
			handlerWith([]),
			"get_event",
			{ eventId: "abcdefghijkl" },
			"Event not found",
		);
	});

	it("maps an expired event to a gone error", async () => {
		await expectToolError(
			handlerWith([eventRow({ expiresAt: Date.now() - 1000 })]),
			"get_event",
			{ eventId: "abcdefghijkl" },
			"Event no longer available",
		);
	});

	it("maps out-of-universe slots to an invalid slot error", async () => {
		await expectToolError(
			handlerWith([eventRow()]),
			"save_availability",
			{
				eventId: "abcdefghijkl",
				name: "Ada",
				slots: ["2000-01-01T09:00"],
			},
			"outside the event",
		);
	});

	it("maps a missing poll to a poll not found error", async () => {
		await expectToolError(
			handlerWith([eventRow()]),
			"vote_poll",
			{
				eventId: "abcdefghijkl",
				name: "Ada",
				optionIds: ["0123456789ab"],
				pollId: "0123456789ab",
			},
			"Poll not found",
		);
	});

	it("maps a failed event insert to a could not create error", async () => {
		await expectToolError(
			handlerWith([]),
			"create_event",
			{
				dates: [todayDate()],
				endTime: "10:00",
				startTime: "09:00",
				timezone: "America/New_York",
				title: "Team sync",
			},
			"Could not create event",
		);
	});

	it("round-trips create_event then get_event on a real database", async () => {
		const { db } = await createTestDb();
		const handler = createSdkMcpHandler(db, "https://example.com");
		const eventId = await createRealEvent(handler);
		const fetched = await callTool(handler, "get_event", { eventId });
		expect(fetched?.isError).toBeFalsy();
		const detail = structuredRecord(fetched) as {
			event?: { id?: unknown; title?: unknown };
		};
		expect(detail.event?.id).toBe(eventId);
		expect(detail.event?.title).toBe("Team sync");
	});

	it("creates a poll on a real database", async () => {
		const { db } = await createTestDb();
		const handler = createSdkMcpHandler(db, "https://example.com");
		const eventId = await createRealEvent(handler);
		const result = await callTool(handler, "create_poll", {
			eventId,
			options: ["Yes", "No"],
			question: "Lunch?",
		});
		expect(result?.isError).toBeFalsy();
		const record = structuredRecord(result) as {
			poll?: { id?: unknown; question?: unknown; options?: unknown[] };
		};
		expect(typeof record.poll?.id).toBe("string");
		expect(record.poll?.question).toBe("Lunch?");
		expect(record.poll?.options).toHaveLength(2);
	});

	it("saves availability on a real database", async () => {
		const { db } = await createTestDb();
		const handler = createSdkMcpHandler(db, "https://example.com");
		const eventId = await createRealEvent(handler);
		const result = await callTool(handler, "save_availability", {
			eventId,
			name: "Ada",
			slots: [],
		});
		expect(result?.isError).toBeFalsy();
		const record = structuredRecord(result);
		expect(record.name).toBe("Ada");
		expect(record.count).toBe(0);
	});

	it("votes in a poll on a real database", async () => {
		const { db } = await createTestDb();
		const handler = createSdkMcpHandler(db, "https://example.com");
		const eventId = await createRealEvent(handler);
		const created = await callTool(handler, "create_poll", {
			eventId,
			options: ["Yes", "No"],
			question: "Lunch?",
		});
		const poll = structuredRecord(created) as {
			poll?: { id?: unknown; options?: Array<{ id?: unknown }> };
		};
		const pollId = poll.poll?.id as string;
		const optionId = poll.poll?.options?.[0]?.id as string;
		expect(typeof pollId).toBe("string");
		expect(typeof optionId).toBe("string");
		const voted = await callTool(handler, "vote_poll", {
			eventId,
			name: "Ada",
			optionIds: [optionId],
			pollId,
		});
		expect(voted?.isError).toBeFalsy();
		expect(structuredRecord(voted).pollId).toBe(pollId);
		const fetched = await callTool(handler, "get_event", { eventId });
		const detail = structuredRecord(fetched) as {
			polls?: Array<{ id?: unknown; totalVoters?: unknown }>;
		};
		expect(
			detail.polls?.find((entry) => entry.id === pollId)?.totalVoters,
		).toBe(1);
	});
});
