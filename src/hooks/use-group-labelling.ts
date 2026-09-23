import { useId } from "react";

export interface GroupLabelling {
	labelId: string;
	hintId: string;
	groupProps: () => {
		"aria-labelledby": string;
		"aria-describedby": string;
	};
}

function toSafe(prefix: string): string {
	const cleaned = prefix
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return cleaned === "" ? "group" : cleaned;
}

export function useGroupLabelling(prefix: string): GroupLabelling {
	const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
	const safe = toSafe(prefix);
	const labelId = `${safe}-${uid}-label`;
	const hintId = `${safe}-${uid}-hint`;
	return {
		groupProps: () => ({
			"aria-describedby": hintId,
			"aria-labelledby": labelId,
		}),
		hintId,
		labelId,
	};
}
