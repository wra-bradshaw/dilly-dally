import type { EventDetailResponse } from "./client";
import { findBestTimes } from "./time-slots";

export function patchDetailForSave(
	detail: EventDetailResponse,
	name: string,
	slots: Set<string> | string[],
	updatedAt: string,
): EventDetailResponse {
	const set = slots instanceof Set ? slots : new Set(slots);
	const counts = detail.counts.map((c) => {
		const names = new Set(c.names);
		if (set.has(c.slot)) names.add(name);
		else names.delete(name);
		const list = [...names].sort((a, b) => a.localeCompare(b));
		return { count: list.length, names: list, slot: c.slot };
	});
	const participants = detail.participants.some((p) => p.name === name)
		? detail.participants.map((p) =>
				p.name === name ? { ...p, count: set.size, updatedAt } : p,
			)
		: [...detail.participants, { count: set.size, name, updatedAt }];
	const bestTimes = findBestTimes(counts, 10).map(({ count, slot }) => ({
		count,
		slot,
	}));
	return { ...detail, bestTimes, counts, participants };
}
