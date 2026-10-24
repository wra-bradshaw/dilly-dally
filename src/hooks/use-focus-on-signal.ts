import { type RefObject, useEffect, useRef } from "react";

export function useFocusOnSignal<T extends HTMLElement>(
	signal: string | boolean,
): RefObject<T | null> {
	const ref = useRef<T | null>(null);
	const previous = useRef<string | boolean>(
		typeof signal === "string" ? "" : false,
	);
	useEffect(() => {
		const wasActive =
			typeof previous.current === "string"
				? previous.current !== ""
				: previous.current;
		const isActive = typeof signal === "string" ? signal !== "" : signal;
		const changed = signal !== previous.current;
		if (isActive && (!wasActive || changed)) {
			ref.current?.focus();
		}
		previous.current = signal;
	}, [signal]);
	return ref;
}
