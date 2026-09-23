import { createFileRoute } from "@tanstack/react-router";
import { agentGuideResponse } from "#/lib/agent-guide";

export const Route = createFileRoute("/api/agent-guide")({
	server: {
		handlers: {
			GET: ({ request }) => agentGuideResponse(request),
		},
	},
});
