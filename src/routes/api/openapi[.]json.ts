import { createFileRoute } from "@tanstack/react-router";
import { originOf } from "#/lib/api-errors";
import { getOpenApiSpec } from "#/lib/openapi";

export const Route = createFileRoute("/api/openapi.json")({
	server: {
		handlers: {
			GET: ({ request }) => {
				return Response.json(getOpenApiSpec(originOf(request)), {
					headers: { "Cache-Control": "public, max-age=3600" },
				});
			},
		},
	},
});
