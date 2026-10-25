import type { EventDetailResponse } from "#/lib/client";
import { nameKey } from "#/lib/validation";
import { countUniqueVoters } from "./poll-utils";

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
		return { ...p, options, totalVoters: countUniqueVoters(options, nameKey) };
	});
	return { ...detail, polls };
}
