import handler from "@tanstack/react-start/server-entry";
import { drizzle } from "drizzle-orm/d1";
import { documentSecurityHeaders } from "./lib/api-errors";
import { purgeExpired } from "./lib/db";
import { RateLimiter } from "./lib/rate-limiter-do";
import * as schema from "./lib/schema";

export { RateLimiter };

function withDocumentHeaders(res: Response): Response {
	const contentType = res.headers.get("content-type") ?? "";
	if (!contentType.includes("text/html")) return res;
	const headers = new Headers(res.headers);
	for (const [key, value] of Object.entries(documentSecurityHeaders())) {
		headers.set(key, value);
	}
	return new Response(res.body, {
		headers,
		status: res.status,
		statusText: res.statusText,
	});
}

export default {
	async fetch(...args: Parameters<typeof handler.fetch>): Promise<Response> {
		return withDocumentHeaders(await handler.fetch(...args));
	},
	async scheduled(
		_controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		const db = drizzle(env.DB, { schema });
		await purgeExpired(db, Date.now());
	},
};
