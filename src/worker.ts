import handler from "@tanstack/react-start/server-entry";
import { drizzle } from "drizzle-orm/d1";
import {
	agentGuideResponse,
	eventDetailMarkdownResponse,
	markdownErrorResponse,
} from "./lib/agent-guide";
import { wantsMarkdown } from "./lib/agent-negotiation";
import { documentSecurityHeaders, originOf } from "./lib/api-errors";
import { purgeExpired } from "./lib/db";
import { getDb } from "./lib/db-env";
import { HttpError } from "./lib/http-error";
import { RATE_LIMITS } from "./lib/rate-limit";
import * as schema from "./lib/schema";
import { loadEventDetailFromDb } from "./lib/server-event-detail";
import { guardRateLimit } from "./lib/server-rate-limit";

export function needsDocumentHeaders(contentType: string | null): boolean {
	return (contentType ?? "").toLowerCase().includes("text/html");
}

export function mergeVary(existing: string | null): string {
	const seen = new Set(
		(existing ?? "")
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean),
	);
	const out = (existing ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	for (const v of ["Accept", "User-Agent", "Cookie"]) {
		if (!seen.has(v.toLowerCase())) out.push(v);
	}
	return out.join(", ");
}

export function withDocumentHeaders(res: Response): Response {
	if (!needsDocumentHeaders(res.headers.get("content-type"))) return res;
	const headers = new Headers(res.headers);
	for (const [key, value] of Object.entries(documentSecurityHeaders())) {
		headers.set(key, value);
	}
	headers.set("vary", mergeVary(headers.get("vary")));
	return new Response(res.body, {
		headers,
		status: res.status,
		statusText: res.statusText,
	});
}

type MarkdownRoute = { kind: "home" } | { eventId: string; kind: "event" };

export function markdownRoute(url: URL): MarkdownRoute | null {
	if (url.pathname === "/") return { kind: "home" };
	const match = /^\/e\/([^/]+)\/?$/.exec(url.pathname);
	if (match?.[1]) return { eventId: match[1], kind: "event" };
	return null;
}

function withVary(res: Response): Response {
	const headers = new Headers(res.headers);
	headers.set("vary", mergeVary(headers.get("vary")));
	return new Response(res.body, {
		headers,
		status: res.status,
		statusText: res.statusText,
	});
}

export async function maybeServeMarkdown(
	request: Request,
): Promise<Response | null> {
	if (!wantsMarkdown(request)) return null;
	const url = new URL(request.url);
	const route = markdownRoute(url);
	if (!route) return null;
	if (route.kind === "home") return agentGuideResponse(request);
	const [limited, detail] = await Promise.all([
		guardRateLimit(request, "read", RATE_LIMITS.read, {
			noStore: true,
		}),
		loadEventDetailFromDb(getDb(), route.eventId, Date.now()).then(
			(value) => ({ ok: true as const, value }),
			(error: unknown) => ({ error, ok: false as const }),
		),
	]);
	if (limited) return withVary(limited);
	if (!detail.ok) {
		const err = detail.error;
		if (err instanceof HttpError) {
			const expired = err.code === "gone";
			return markdownErrorResponse(
				expired ? "Event expired" : err.message,
				expired
					? "Events are deleted after they pass to free up space."
					: "Check the link and try again.",
				err.status,
			);
		}
		return markdownErrorResponse(
			"Something went wrong",
			"Try again in a moment.",
			500,
		);
	}
	return eventDetailMarkdownResponse(
		detail.value,
		originOf(request),
		route.eventId,
	);
}

export default {
	async fetch(...args: Parameters<typeof handler.fetch>): Promise<Response> {
		const negotiated = await maybeServeMarkdown(args[0] as Request);
		if (negotiated) return negotiated;
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
