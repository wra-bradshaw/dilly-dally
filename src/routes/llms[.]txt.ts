import { createFileRoute } from "@tanstack/react-router";

const LLMS = `Dilly-Dally: agent-friendly when2meet replacement. No login.
- Create events: POST /api/events (see /api/agent-guide for curl)
- Availability: PUT /api/events/:id/availability
- OpenAPI 3.1: /api/openapi.json
- Full agent guide: /api/agent-guide
`;

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: () => {
				return new Response(LLMS, {
					headers: {
						"Cache-Control": "public, max-age=3600",
						"Content-Type": "text/plain; charset=utf-8",
					},
				});
			},
		},
	},
});
