import { describe, expect, it } from "vitest";
import type { EventDetailResponse } from "./client";
import { patchDetailForPollVote } from "./detail-patch";

function baseDetail(): EventDetailResponse {
	return {
		bestTimes: [],
		counts: [],
		event: {
			createdAt: new Date(1000).toISOString(),
			dates: ["2026-10-05"],
			endTime: "10:00",
			expiresAt: new Date(2000).toISOString(),
			id: "AbC123_-XyZ9",
			mode: "dates",
			startTime: "09:00",
			timezone: "UTC",
			title: "T",
			weekdays: [],
		},
		participants: [],
		polls: [
			{
				allowMultiple: false,
				id: "poll1",
				options: [
					{ count: 1, id: "optA", label: "A", names: ["Ada"] },
					{ count: 0, id: "optB", label: "B", names: [] },
				],
				question: "Q?",
				totalVoters: 1,
			},
		],
		slotUniverse: [],
	};
}

describe("patchDetailForPollVote", () => {
	it("moves a single-choice vote", () => {
		const next = patchDetailForPollVote(baseDetail(), "poll1", "Ada", ["optB"]);
		expect(next.polls[0]?.options[0]).toMatchObject({
			count: 0,
			names: [],
		});
		expect(next.polls[0]?.options[1]).toMatchObject({
			count: 1,
			names: ["Ada"],
		});
	});

	it("clears votes on empty", () => {
		const next = patchDetailForPollVote(baseDetail(), "poll1", "Ada", []);
		expect(next.polls[0]?.totalVoters).toBe(0);
	});

	it("counts multi-choice votes and unique voters", () => {
		const base = baseDetail();
		const multi = {
			...base,
			polls: [
				{
					allowMultiple: true,
					id: "poll1",
					options: [
						{ count: 1, id: "optA", label: "A", names: ["Ada"] },
						{ count: 1, id: "optB", label: "B", names: ["Bo"] },
					],
					question: "Q?",
					totalVoters: 2,
				},
			],
		};
		const next = patchDetailForPollVote(multi, "poll1", "Ada", [
			"optA",
			"optB",
		]);
		expect(next.polls[0]?.options[0]).toMatchObject({
			count: 1,
			names: ["Ada"],
		});
		expect(next.polls[0]?.options[1]).toMatchObject({
			count: 2,
			names: ["Ada", "Bo"],
		});
		expect(next.polls[0]?.totalVoters).toBe(2);
	});

	it("is last-writer-wins for rapid toggles", () => {
		const base = baseDetail();
		const first = patchDetailForPollVote(base, "poll1", "Ada", ["optA"]);
		const second = patchDetailForPollVote(first, "poll1", "Ada", ["optB"]);
		const direct = patchDetailForPollVote(base, "poll1", "Ada", ["optB"]);
		expect(second).toEqual(direct);
	});

	it("does not mutate the cached input", () => {
		const base = baseDetail();
		patchDetailForPollVote(base, "poll1", "Ada", ["optB"]);
		expect(base.polls[0]?.options[0]).toMatchObject({
			count: 1,
			names: ["Ada"],
		});
		expect(base.polls[0]?.totalVoters).toBe(1);
	});
});
