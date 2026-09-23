import { createFileRoute } from "@tanstack/react-router";
import { llmsResponse } from "#/lib/agent-guide";

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: () => llmsResponse(),
		},
	},
});
