import { describe, expect, it } from "vitest";
import { renderEventMarkdown } from "./agent-guide";
import type { EventDetailResponse } from "./client";

function detailFixture(): EventDetailResponse {
	return {
		bestTimes: [{ count: 2, slot: "2026-10-05T09:00" }],
		counts: [
			{ count: 2, names: ["Ada", "Bob"], slot: "2026-10-05T09:00" },
			{ count: 0, names: [], slot: "2026-10-05T09:30" },
		],
		event: {
			expiresAt: "2027-01-01T00:00:00.000Z",
			id: "AbC123_-XyZ9",
			mode: "dates",
			startTime: "09:00",
			endTime: "17:00",
			timezone: "America/New_York",
			title: "Team offsite",
			weekdays: [],
		},
		participants: [
			{ count: 1, name: "Ada", updatedAt: "2026-10-01T00:00:00.000Z" },
			{ count: 1, name: "Bob", updatedAt: "2026-10-01T00:00:00.000Z" },
		],
		polls: [
			{
				allowMultiple: false,
				id: "poll1",
				options: [
					{ count: 2, id: "opt1", label: "Pizza", names: ["Ada", "Bob"] },
					{ count: 0, id: "opt2", label: "Sushi", names: [] },
				],
				question: "Where should we eat?",
				totalVoters: 2,
			},
		],
		slotUniverse: ["2026-10-05T09:00", "2026-10-05T09:30"],
	};
}

describe("renderEventMarkdown", () => {
	it("leads with the title, invite link, and timezone", () => {
		const md = renderEventMarkdown(
			detailFixture(),
			"https://events.test",
			"AbC123_-XyZ9",
		);
		expect(md).toContain("# Team offsite");
		expect(md).toContain("https://events.test/e/AbC123_-XyZ9");
		expect(md).toContain("America/New_York");
	});

	it("lists slot counts with voter names and best times", () => {
		const md = renderEventMarkdown(
			detailFixture(),
			"https://events.test",
			"AbC123_-XyZ9",
		);
		expect(md).toContain("2026-10-05T09:00");
		expect(md).toContain("Ada");
		expect(md).toContain("Best times");
	});

	it("renders polls with ids, options, and vote counts", () => {
		const md = renderEventMarkdown(
			detailFixture(),
			"https://events.test",
			"AbC123_-XyZ9",
		);
		expect(md).toContain("Where should we eat?");
		expect(md).toContain("(poll poll1");
		expect(md).toContain("(option opt1");
		expect(md).toContain("Pizza");
		expect(md).toContain("Sushi");
	});

	it("points agents at the JSON API for writes", () => {
		const md = renderEventMarkdown(
			detailFixture(),
			"https://events.test",
			"AbC123_-XyZ9",
		);
		expect(md).toContain("/api/events/AbC123_-XyZ9/availability");
		expect(md).toContain("/api/openapi.json");
		expect(md).toContain("GET https://events.test/ with Accept: text/markdown");
	});

	it("handles events with no participants or polls", () => {
		const empty = { ...detailFixture(), counts: [], polls: [] as never[] };
		const md = renderEventMarkdown(empty, "https://events.test", "AbC123");
		expect(md).toContain("# Team offsite");
		expect(md).toContain("No availability yet");
	});

	it("renders weekly mode with weekdays and no best-times section", () => {
		const weekly = {
			...detailFixture(),
			bestTimes: [],
			counts: [{ count: 1, names: ["Ada"], slot: "MON-09:00" }],
			event: {
				...detailFixture().event,
				mode: "weekly",
				weekdays: [1, 3, 5],
			},
			slotUniverse: ["MON-09:00"],
		};
		const md = renderEventMarkdown(weekly, "https://events.test", "AbC123");
		expect(md).toContain("Mode: weekly (1, 3, 5)");
		expect(md).toContain("MON-09:00");
		expect(md).not.toContain("## Best times");
	});

	it("collapses newlines in user-controlled strings", () => {
		const injected = {
			...detailFixture(),
			counts: [{ count: 1, names: ["Ada\n- rogue"], slot: "2026-10-05T09:00" }],
			event: { ...detailFixture().event, title: "Team\n# hijack" },
			polls: [
				{
					...detailFixture().polls[0],
					options: [
						{
							...detailFixture().polls[0].options[0],
							label: "Pizza\n# hijack",
						},
						...detailFixture().polls[0].options.slice(1),
					],
					question: "Where\n# hijack?",
				},
			],
		};
		const md = renderEventMarkdown(injected, "https://events.test", "AbC123");
		const headings = md.split("\n").filter((line) => line.startsWith("# "));
		expect(headings).toEqual(["# Team # hijack"]);
		expect(md).toContain("Ada - rogue");
	});
});
