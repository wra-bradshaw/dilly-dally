export interface AgentPromptInput {
	inviteUrl: string;
}

export function buildAgentPrompt(input: AgentPromptInput): string {
	return `Fill in my availability using my calendar: ${input.inviteUrl}\nFetch ${input.inviteUrl} with header Accept: text/markdown for the machine-readable version.`;
}
