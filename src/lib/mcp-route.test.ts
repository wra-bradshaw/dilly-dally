import { beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "#/lib/rate-limit";
import { guardRateLimit } from "#/lib/server-rate-limit";
import { handleMcp } from "#/routes/mcp";

vi.mock("#/lib/db-env", () => ({
	getDb: () => ({ mocked: true }),
}));

const { stubHandler, stubMcp } = vi.hoisted(() => ({
	stubHandler: vi.fn(),
	stubMcp: vi.fn(),
}));

vi.mock("#/lib/mcp-sdk", () => ({
	createSdkMcpHandler: (...args: unknown[]) => stubMcp(...args),
}));

vi.mock("#/lib/server-rate-limit", () => ({
	guardRateLimit: vi.fn(),
}));

const mockGuard = vi.mocked(guardRateLimit);

function postMcp(headers?: Record<string, string>) {
	return new Request("https://x.test/mcp", {
		body: JSON.stringify({
			id: 1,
			jsonrpc: "2.0",
			method: "ping",
		}),
		headers: { "content-type": "application/json", ...headers },
		method: "POST",
	});
}

function postRpc(
	method: string,
	params: unknown,
	id: unknown = 1,
	headers?: Record<string, string>,
) {
	return new Request("https://x.test/mcp", {
		body: JSON.stringify({ id, jsonrpc: "2.0", method, params }),
		headers: { "content-type": "application/json", ...headers },
		method: "POST",
	});
}

function throttledResponse(retryAfter = "5"): Response {
	return new Response(
		JSON.stringify({
			error: { code: "rate_limited", message: "Too many requests" },
		}),
		{
			headers: {
				"Content-Type": "application/json",
				"Retry-After": retryAfter,
			},
			status: 429,
		},
	);
}

beforeEach(() => {
	stubMcp.mockReset();
	stubHandler.mockReset();
	mockGuard.mockReset();
	mockGuard.mockResolvedValue(null);
});

describe("handleMcp routing", () => {
	it.each([
		undefined,
		"https://x.test",
	])("passes POST through with origin %s", async (origin) => {
		stubMcp.mockReturnValueOnce(stubHandler);
		stubHandler.mockResolvedValueOnce(Response.json({ ok: true }));
		const res = await handleMcp(postMcp(origin ? { origin } : undefined));
		expect(res.status).toBe(200);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(await res.json()).toEqual({ ok: true });
		expect(stubMcp).toHaveBeenCalledWith({ mocked: true }, "https://x.test");
		expect(stubHandler).toHaveBeenCalledOnce();
		expect(mockGuard).toHaveBeenCalledOnce();
	});

	it.each([
		"GET",
		"DELETE",
		"HEAD",
		"OPTIONS",
	] as const)("rejects %s with 405", async (method) => {
		const res = await handleMcp(new Request("https://x.test/mcp", { method }));
		expect(res.status).toBe(405);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		const body = (await res.json()) as {
			error: { code: number };
			id: null;
			jsonrpc: string;
		};
		expect(body.jsonrpc).toBe("2.0");
		expect(body.id).toBeNull();
		expect(body.error.code).toBe(-32601);
		expect(stubMcp).not.toHaveBeenCalled();
		expect(mockGuard).not.toHaveBeenCalled();
	});

	it.each([
		"https://evil.test",
		"not-a-url",
	] as const)("rejects origin %s with 403", async (origin) => {
		const res = await handleMcp(postMcp({ origin }));
		expect(res.status).toBe(403);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		const body = (await res.json()) as {
			error: { code: number };
			id: null;
		};
		expect(body.id).toBeNull();
		expect(body.error.code).toBe(-32000);
		expect(stubMcp).not.toHaveBeenCalled();
		expect(stubHandler).not.toHaveBeenCalled();
	});

	it.each([
		["server/discover", {}, 11],
		["tools/list", {}, 12],
		[
			"tools/call",
			{ arguments: { eventId: "abcdefghijkl" }, name: "get_event" },
			3,
		],
		["tools/call", { arguments: {}, name: "nope_tool" }, 4],
	] as Array<
		[string, unknown, number]
	>)("uses read scope for %s", async (method, params, id) => {
		stubMcp.mockReturnValueOnce(stubHandler);
		stubHandler.mockResolvedValueOnce(Response.json({ ok: true }));
		const res = await handleMcp(postRpc(method, params, id));
		expect(res.status).toBe(200);
		expect(mockGuard).toHaveBeenCalledOnce();
		const [, scope, budget] = mockGuard.mock.calls[0] as [
			Request,
			string,
			unknown,
		];
		expect(scope).toBe("read");
		expect(budget).toEqual(RATE_LIMITS.read);
		expect(stubHandler).toHaveBeenCalledOnce();
	});

	it.each([
		["save_availability", 5],
		["create_poll", 6],
		["vote_poll", 7],
	] as Array<
		[string, number]
	>)("uses availability_write scope for %s", async (name, id) => {
		stubMcp.mockReturnValueOnce(stubHandler);
		stubHandler.mockResolvedValueOnce(Response.json({ ok: true }));
		const res = await handleMcp(
			postRpc("tools/call", { arguments: {}, name }, id),
		);
		expect(res.status).toBe(200);
		expect(mockGuard).toHaveBeenCalledOnce();
		const [, scope, budget] = mockGuard.mock.calls[0] as [
			Request,
			string,
			unknown,
		];
		expect(scope).toBe("availability_write");
		expect(budget).toEqual(RATE_LIMITS.availabilityWrite);
		expect(stubHandler).toHaveBeenCalledOnce();
	});

	it("throttled create_event returns 429 without calling SDK handler", async () => {
		mockGuard.mockResolvedValueOnce(throttledResponse("5"));
		const res = await handleMcp(
			postRpc("tools/call", { arguments: {}, name: "create_event" }, 7),
		);
		expect(mockGuard).toHaveBeenCalledOnce();
		const [, scope, budget] = mockGuard.mock.calls[0] as [
			Request,
			string,
			unknown,
		];
		expect(scope).toBe("create_event");
		expect(budget).toEqual(RATE_LIMITS.createEvent);
		expect(stubMcp).not.toHaveBeenCalled();
		expect(stubHandler).not.toHaveBeenCalled();
		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBe("5");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		const body = (await res.json()) as {
			error: { code: number; message: string };
			id: unknown;
			jsonrpc: string;
		};
		expect(body.jsonrpc).toBe("2.0");
		expect(body.id).toBe(7);
		expect(body.error.code).toBe(-32000);
	});

	it.each([
		[
			"create_event wins over read",
			[
				{ id: 1, jsonrpc: "2.0", method: "tools/list", params: {} },
				{
					id: 2,
					jsonrpc: "2.0",
					method: "tools/call",
					params: { arguments: {}, name: "create_event" },
				},
			],
			"create_event",
			RATE_LIMITS.createEvent,
		],
		[
			"availability_write wins over read",
			[
				{ id: 1, jsonrpc: "2.0", method: "tools/list", params: {} },
				{
					id: 2,
					jsonrpc: "2.0",
					method: "tools/call",
					params: { arguments: {}, name: "save_availability" },
				},
			],
			"availability_write",
			RATE_LIMITS.availabilityWrite,
		],
	] as Array<
		[string, unknown, string, unknown]
	>)("batch strictest wins: %s", async (_label, batch, scope, budget) => {
		stubMcp.mockReturnValueOnce(stubHandler);
		stubHandler.mockResolvedValueOnce(Response.json({ ok: true }));
		const req = new Request("https://x.test/mcp", {
			body: JSON.stringify(batch),
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		const res = await handleMcp(req);
		expect(res.status).toBe(200);
		expect(mockGuard).toHaveBeenCalledOnce();
		const [, actualScope, actualBudget] = mockGuard.mock.calls[0] as [
			Request,
			string,
			unknown,
		];
		expect(actualScope).toBe(scope);
		expect(actualBudget).toEqual(budget);
		expect(stubHandler).toHaveBeenCalledOnce();
	});

	it("returns 429 before 403 for throttled cross-origin requests", async () => {
		mockGuard.mockResolvedValueOnce(throttledResponse("9"));
		const res = await handleMcp(
			postRpc(
				"tools/call",
				{ arguments: { eventId: "abcdefghijkl" }, name: "get_event" },
				21,
				{ origin: "https://evil.test" },
			),
		);
		expect(res.status).toBe(429);
		expect(stubMcp).not.toHaveBeenCalled();
		expect(stubHandler).not.toHaveBeenCalled();
		expect(res.headers.get("Retry-After")).toBe("9");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		const body = (await res.json()) as { id: unknown };
		expect(body.id).toBe(21);
	});

	it("applies read scope to invalid JSON then passes through", async () => {
		stubMcp.mockReturnValueOnce(stubHandler);
		stubHandler.mockResolvedValueOnce(Response.json({ ok: true }));
		const req = new Request("https://x.test/mcp", {
			body: "{not-json",
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		const res = await handleMcp(req);
		expect(mockGuard).toHaveBeenCalledOnce();
		const [, scope, budget] = mockGuard.mock.calls[0] as [
			Request,
			string,
			unknown,
		];
		expect(scope).toBe("read");
		expect(budget).toEqual(RATE_LIMITS.read);
		expect(stubHandler).toHaveBeenCalledOnce();
		expect(res.status).toBe(200);
	});

	it("returns 429 with null id for throttled invalid JSON", async () => {
		mockGuard.mockResolvedValueOnce(throttledResponse("5"));
		const req = new Request("https://x.test/mcp", {
			body: "{not-json",
			headers: { "content-type": "application/json" },
			method: "POST",
		});
		const res = await handleMcp(req);
		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBe("5");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		const body = (await res.json()) as {
			error: { code: number };
			id: unknown;
		};
		expect(body.id).toBeNull();
		expect(body.error.code).toBe(-32000);
		expect(stubMcp).not.toHaveBeenCalled();
		expect(stubHandler).not.toHaveBeenCalled();
	});
});
