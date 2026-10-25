import { env } from "cloudflare:workers";

export function allowRateLimit() {
	return {
		limit: async () => ({ success: true }),
	};
}

export function denyRateLimit() {
	return {
		limit: async () => ({ success: false }),
	};
}

export function stubRateLimiters(
	binding: unknown,
	scopes: Array<"read" | "write" | "create"> = ["read", "write", "create"],
) {
	const record = env as unknown as Record<string, unknown>;
	const targets =
		scopes.length === 3
			? ["READ_LIMITER", "AVAIL_WRITE_LIMITER", "CREATE_EVENT_LIMITER"]
			: scopes.map((scope) =>
					scope === "read"
						? "READ_LIMITER"
						: scope === "create"
							? "CREATE_EVENT_LIMITER"
							: "AVAIL_WRITE_LIMITER",
				);
	for (const name of targets) record[name] = binding;
}
