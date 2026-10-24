import type { EventDetailResponse } from "#/lib/client";
import { nameKey } from "#/lib/validation";

export function patchDetailForNewPoll(
	detail: EventDetailResponse,
	poll: EventDetailResponse["polls"][number],
): EventDetailResponse {
	return { ...detail, polls: [...(detail.polls ?? []), poll] };
}

export function patchDetailForNewOption(
	detail: EventDetailResponse,
	pollId: string,
	option: { id: string; label: string },
): EventDetailResponse {
	const polls = (detail.polls ?? []).map((p) => {
		if (p.id !== pollId) return p;
		return {
			...p,
			options: [
				...p.options,
				{ count: 0, id: option.id, label: option.label, names: [] },
			],
		};
	});
	return { ...detail, polls };
}

export function patchDetailForDeleteOption(
	detail: EventDetailResponse,
	pollId: string,
	optionId: string,
): EventDetailResponse {
	const polls = (detail.polls ?? []).map((p) => {
		if (p.id !== pollId) return p;
		const options = p.options.filter((o) => o.id !== optionId);
		const voters = new Set<string>();
		for (const o of options) for (const n of o.names) voters.add(nameKey(n));
		return { ...p, options, totalVoters: voters.size };
	});
	return { ...detail, polls };
}
