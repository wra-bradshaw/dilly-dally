import { describe, expect, it } from "vitest";
import type { EventDetailResponse } from "#/lib/client";
import {
	patchDetailForDeleteOption,
	patchDetailForNewOption,
	patchDetailForNewPoll,
} from "./poll-patch";

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

describe("patchDetailForNewPoll and options", () => {
	it("appends polls and options", () => {
		const detail = baseDetail();
		const withPoll = patchDetailForNewPoll(detail, {
			allowMultiple: true,
			id: "poll2",
			options: [],
			question: "Q2?",
			totalVoters: 0,
		});
		expect(withPoll.polls).toHaveLength(2);
		const withOpt = patchDetailForNewOption(withPoll, "poll2", {
			id: "optC",
			label: "C",
		});
		expect(withOpt.polls.find((p) => p.id === "poll2")?.options).toHaveLength(
			1,
		);
		const without = patchDetailForDeleteOption(withOpt, "poll2", "optC");
		expect(without.polls.find((p) => p.id === "poll2")?.options).toHaveLength(
			0,
		);
	});
});
