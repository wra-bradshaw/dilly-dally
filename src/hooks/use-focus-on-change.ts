import { type RefObject, useEffect, useRef } from "react";

export function useFocusOnChange<T extends HTMLElement>(
	active: boolean,
): RefObject<T | null> {
	const ref = useRef<T | null>(null);
	const previous = useRef(false);
	useEffect(() => {
		if (active && !previous.current) {
			ref.current?.focus();
		}
		previous.current = active;
	}, [active]);
	return ref;
}
