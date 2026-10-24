import { describe, expect, it } from "vitest";
import { buildAgentPrompt } from "./agent-prompt";

describe("buildAgentPrompt", () => {
	it("contains the event link, the guide link, and the calendar instruction", () => {
		const prompt = buildAgentPrompt({
			guideUrl: "https://example.com/api/agent-guide",
			inviteUrl: "https://example.com/e/AbC123",
		});
		expect(prompt).toContain("https://example.com/e/AbC123");
		expect(prompt).toContain("https://example.com/api/agent-guide");
		expect(prompt).toMatch(/fill in my availability using my calendar/i);
	});

	it("stays brief", () => {
		const prompt = buildAgentPrompt({
			guideUrl: "https://example.com/api/agent-guide",
			inviteUrl: "https://example.com/e/AbC123",
		});
		expect(prompt.split("\n").length).toBeLessThanOrEqual(3);
		expect(prompt.length).toBeLessThan(300);
	});
});
