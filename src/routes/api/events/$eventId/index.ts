import { createFileRoute } from "@tanstack/react-router";
import { jsonError, securityHeaders } from "#/lib/api-errors";
import { getDb } from "#/lib/db-env";
import { HttpError } from "#/lib/http-error";
import { RATE_LIMITS } from "#/lib/rate-limit";
import { loadEventDetailFromDb } from "#/lib/server-event-detail";
import { guardRateLimit } from "#/lib/server-rate-limit";

export async function handleGetDetail(
	eventId: string,
	request: Request,
): Promise<Response> {
	const db = getDb();
	const now = Date.now();
	const [throttled, detail] = await Promise.all([
		guardRateLimit(request, "read", RATE_LIMITS.read, {
			noStore: true,
		}),
		loadEventDetailFromDb(db, eventId, now).then(
			(value) => ({ ok: true as const, value }),
			(error: unknown) => ({ error, ok: false as const }),
		),
	]);
	if (throttled) return throttled;
	if (!detail.ok) {
		const err = detail.error;
		if (err instanceof HttpError) {
			return jsonError(err.code, err.message, err.status, undefined, {
				noStore: true,
			});
		}
		throw err;
	}
	return Response.json(detail.value, {
		headers: {
			...securityHeaders(),
			"Cache-Control": "no-store",
		},
	});
}

export const Route = createFileRoute("/api/events/$eventId/")({
	server: {
		handlers: {
			GET: ({ params, request }) => handleGetDetail(params.eventId, request),
		},
	},
});
