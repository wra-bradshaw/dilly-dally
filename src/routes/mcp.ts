import { createFileRoute } from "@tanstack/react-router";
import { isCrossOrigin, originOf, securityHeaders } from "#/lib/api-errors";
import { getDb } from "#/lib/db-env";
import { jsonRpcError } from "#/lib/mcp-guard";
import { mcpRpcId, resolveMcpLimit } from "#/lib/mcp-limits";
import { createSdkMcpHandler } from "#/lib/mcp-sdk";
import { guardRateLimit } from "#/lib/server-rate-limit";

export async function handleMcp(request: Request): Promise<Response> {
	if (request.method !== "POST")
		return jsonRpcError(-32601, "Method Not Allowed", null, 405);
	let parsed: unknown;
	let hasParsed = false;
	try {
		parsed = await request.clone().json();
		hasParsed = true;
	} catch {
		hasParsed = false;
	}
	const { budget, scope } = resolveMcpLimit(hasParsed ? parsed : null);
	const throttled = await guardRateLimit(request, scope, budget);
	if (throttled) {
		const retryAfter = throttled.headers.get("Retry-After");
		return jsonRpcError(
			-32000,
			"Rate limited",
			hasParsed ? mcpRpcId(parsed) : null,
			429,
			retryAfter ? { "Retry-After": retryAfter } : undefined,
		);
	}
	if (isCrossOrigin(request))
		return jsonRpcError(-32000, "Forbidden origin", null, 403);
	const db = getDb();
	const origin = originOf(request);
	const handler = createSdkMcpHandler(db, origin);
	const res = await handler(request);
	const headers = new Headers(res.headers);
	const secure = securityHeaders();
	for (const [key, value] of Object.entries(secure)) {
		headers.set(key, value);
	}
	return new Response(res.body, {
		headers,
		status: res.status,
		statusText: res.statusText,
	});
}

export const Route = createFileRoute("/mcp")({
	server: {
		handlers: {
			DELETE: () => jsonRpcError(-32601, "Method Not Allowed", null, 405),
			GET: () => jsonRpcError(-32601, "Method Not Allowed", null, 405),
			HEAD: () => jsonRpcError(-32601, "Method Not Allowed", null, 405),
			OPTIONS: () => jsonRpcError(-32601, "Method Not Allowed", null, 405),
			POST: ({ request }) => handleMcp(request),
		},
	},
});
