import { createFileRoute } from "@tanstack/react-router";
import { openApiResponse } from "#/lib/openapi";

export const Route = createFileRoute("/api/openapi.json")({
	server: {
		handlers: {
			GET: ({ request }) => openApiResponse(request),
		},
	},
});
