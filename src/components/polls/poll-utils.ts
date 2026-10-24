export function voteShare(count: number, totalVoters: number): number {
	if (totalVoters <= 0) return 0;
	return Math.round((count / totalVoters) * 100);
}

export function ownIdsForName(
	options: Array<{ id: string; names: string[] }>,
	activeName: string,
	keyOf: (name: string) => string,
): Set<string> {
	const activeKey = keyOf(activeName);
	if (activeKey === "") return new Set();
	const ids = new Set<string>();
	for (const o of options) {
		if (o.names.some((n) => keyOf(n) === activeKey)) ids.add(o.id);
	}
	return ids;
}

export function validateNewOptionLabel(
	label: string,
	existing: Array<{ label: string }>,
	maxOptions: number,
): string | null {
	if (label === "") return "Enter an option label.";
	if (existing.length >= maxOptions)
		return `This poll already has ${maxOptions} options.`;
	if (
		existing.some((o) => o.label.trim().toLowerCase() === label.toLowerCase())
	)
		return "This option already exists.";
	return null;
}

export function validatePollDraft(
	question: string,
	labels: string[],
	maxOptions: number,
): string | null {
	if (question === "") return "Give the poll a question.";
	if (labels.length < 2) return "Add at least two options.";
	if (labels.length > maxOptions)
		return `Polls have at most ${maxOptions} options.`;
	const seen = new Set<string>();
	for (const l of labels) {
		const k = l.toLowerCase();
		if (seen.has(k)) return "Poll options must be unique.";
		seen.add(k);
	}
	return null;
}
