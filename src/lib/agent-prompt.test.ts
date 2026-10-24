import { describe, expect, it } from "vitest";
import { buildAgentPrompt } from "./agent-prompt";

describe("buildAgentPrompt", () => {
	it("contains the event link, the markdown hint, and the calendar instruction", () => {
		const prompt = buildAgentPrompt({
			inviteUrl: "https://example.com/e/AbC123",
		});
		expect(prompt).toContain("https://example.com/e/AbC123");
		expect(prompt).toContain("Accept: text/markdown");
		expect(prompt).toMatch(/fill in my availability using my calendar/i);
	});

	it("stays brief", () => {
		const prompt = buildAgentPrompt({
			inviteUrl: "https://example.com/e/AbC123",
		});
		expect(prompt.split("\n").length).toBeLessThanOrEqual(3);
		expect(prompt.length).toBeLessThan(300);
	});
});
