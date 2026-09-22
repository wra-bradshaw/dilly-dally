import { createFileRoute } from "@tanstack/react-router";
import { AGENT_GUIDE_MARKDOWN } from "#/lib/agent-guide";
import { originOf } from "#/lib/api-errors";

export const Route = createFileRoute("/agents.md")({
	server: {
		handlers: {
			GET: ({ request }) => {
				const guide = AGENT_GUIDE_MARKDOWN.replaceAll(
					"HOST",
					originOf(request),
				);
				return new Response(guide, {
					headers: {
						"Cache-Control": "public, max-age=3600",
						"Content-Type": "text/markdown; charset=utf-8",
					},
				});
			},
		},
	},
});
