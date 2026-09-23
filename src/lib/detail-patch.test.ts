import { describe, expect, it } from "vitest";
import type { EventDetailResponse } from "./client";
import { patchDetailForSave } from "./detail-patch";

function detail(): EventDetailResponse {
	return {
		bestTimes: [{ count: 1, slot: "2026-10-05T09:00" }],
		counts: [
			{ count: 1, names: ["Bob"], slot: "2026-10-05T09:00" },
			{ count: 1, names: ["Bob"], slot: "2026-10-05T09:15" },
		],
		event: {
			createdAt: new Date(1000).toISOString(),
			dates: ["2026-10-05"],
			endTime: "10:00",
			expiresAt: new Date(2000).toISOString(),
			id: "AbC123_-XyZ9",
			mode: "dates",
			startTime: "09:00",
			timezone: "UTC",
			title: "Standup",
			weekdays: [],
		},
		participants: [
			{ count: 2, name: "Bob", updatedAt: new Date(1000).toISOString() },
		],
		slotUniverse: ["2026-10-05T09:00", "2026-10-05T09:15"],
	};
}

describe("patchDetailForSave", () => {
	it("adds a new participant and their votes", () => {
		const out = patchDetailForSave(
			detail(),
			"Ada",
			new Set(["2026-10-05T09:00"]),
			new Date(3000).toISOString(),
		);
		expect(
			out.counts.find((c) => c.slot === "2026-10-05T09:00"),
		).toEqual({ count: 2, names: ["Ada", "Bob"], slot: "2026-10-05T09:00" });
		expect(
			out.counts.find((c) => c.slot === "2026-10-05T09:15"),
		).toEqual({ count: 1, names: ["Bob"], slot: "2026-10-05T09:15" });
		expect(out.participants).toContainEqual({
			count: 1,
			name: "Ada",
			updatedAt: new Date(3000).toISOString(),
		});
		expect(out.bestTimes[0]).toEqual({
			count: 2,
			slot: "2026-10-05T09:00",
		});
	});

	it("removes unvoted slots and drops empty voters", () => {
		const base = patchDetailForSave(
			detail(),
			"Ada",
			["2026-10-05T09:00", "2026-10-05T09:15"],
			new Date(3000).toISOString(),
		);
		const out = patchDetailForSave(
			base,
			"Ada",
			[],
			new Date(4000).toISOString(),
		);
		expect(out.counts.every((c) => !c.names.includes("Ada"))).toBe(true);
		expect(out.participants.find((p) => p.name === "Ada")?.count).toBe(0);
	});

	it("does not mutate the cached input", () => {
		const base = detail();
		patchDetailForSave(base, "Ada", ["2026-10-05T09:00"], "x");
		expect(base.counts[0]?.names).toEqual(["Bob"]);
		expect(base.participants).toHaveLength(1);
	});
});
