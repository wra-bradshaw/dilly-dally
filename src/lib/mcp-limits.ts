import { RATE_LIMITS } from "./rate-limit";

type McpBudget = { limit: number; windowMs: number };
export type McpLimit = { budget: McpBudget; scope: string };

function singleMcpLimit(item: unknown): McpLimit {
	if (typeof item !== "object" || item === null)
		return { budget: RATE_LIMITS.read, scope: "read" };
	const method = (item as { method?: unknown }).method;
	if (method === "server/discover" || method === "tools/list")
		return { budget: RATE_LIMITS.read, scope: "read" };
	if (method === "tools/call") {
		const params = (item as { params?: unknown }).params;
		const name =
			typeof params === "object" && params !== null
				? (params as { name?: unknown }).name
				: undefined;
		if (name === "create_event")
			return { budget: RATE_LIMITS.createEvent, scope: "create_event" };
		if (
			name === "save_availability" ||
			name === "create_poll" ||
			name === "vote_poll"
		)
			return {
				budget: RATE_LIMITS.availabilityWrite,
				scope: "availability_write",
			};
		return { budget: RATE_LIMITS.read, scope: "read" };
	}
	return { budget: RATE_LIMITS.read, scope: "read" };
}

export function resolveMcpLimit(body: unknown): McpLimit {
	if (!Array.isArray(body)) return singleMcpLimit(body);
	let chosen: McpLimit = { budget: RATE_LIMITS.read, scope: "read" };
	for (const item of body) {
		const candidate = singleMcpLimit(item);
		if (
			candidate.budget.limit / candidate.budget.windowMs <
			chosen.budget.limit / chosen.budget.windowMs
		)
			chosen = candidate;
	}
	return chosen;
}

export function mcpRpcId(body: unknown): unknown {
	if (
		typeof body === "object" &&
		body !== null &&
		!Array.isArray(body) &&
		"id" in body
	)
		return (body as { id: unknown }).id ?? null;
	return null;
}
