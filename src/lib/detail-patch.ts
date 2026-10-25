import { countUniqueVoters } from "#/components/polls/poll-utils";
import type { EventDetailResponse } from "./client";
import { findBestTimes } from "./time-slots";
import { nameKey } from "./validation";

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

export function patchDetailForPollVote(
	detail: EventDetailResponse,
	pollId: string,
	name: string,
	optionIds: Set<string> | string[],
): EventDetailResponse {
	const set = optionIds instanceof Set ? optionIds : new Set(optionIds);
	const key = nameKey(name);
	const polls = (detail.polls ?? []).map((p) => {
		if (p.id !== pollId) return p;
		const options = p.options.map((o) => {
			const byKey = new Map<string, string>();
			for (const n of o.names) byKey.set(nameKey(n), n);
			if (set.has(o.id)) byKey.set(key, name);
			else byKey.delete(key);
			const list = [...byKey.values()].sort((a, b) => a.localeCompare(b));
			return { ...o, count: list.length, names: list };
		});
		return { ...p, options, totalVoters: countUniqueVoters(options, nameKey) };
	});
	return { ...detail, polls };
}
