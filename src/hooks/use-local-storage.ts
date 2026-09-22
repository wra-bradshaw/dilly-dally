import { useState } from "react";

export function useLocalStorage(
	key: string,
	initial: string,
): [string, (value: string) => void] {
	const [value, setValue] = useState(() => {
		try {
			return localStorage.getItem(key) ?? initial;
		} catch {
			return initial;
		}
	});
	const set = (next: string) => {
		setValue(next);
		try {
			localStorage.setItem(key, next);
		} catch {
			/* storage unavailable */
		}
	};
	return [value, set];
}
