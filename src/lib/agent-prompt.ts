export interface AgentPromptInput {
	guideUrl: string;
	inviteUrl: string;
}

export function buildAgentPrompt(input: AgentPromptInput): string {
	return `Fill in my availability using my calendar: ${input.inviteUrl}\nGuide: ${input.guideUrl}`;
}
