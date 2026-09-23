import { type RefObject, useEffect, useRef } from "react";

export function useErrorFocus<T extends HTMLElement>(
	error: string,
): RefObject<T | null> {
	const ref = useRef<T | null>(null);
	const previous = useRef("");
	useEffect(() => {
		if (error !== "" && error !== previous.current) {
			ref.current?.focus();
		}
		previous.current = error;
	}, [error]);
	return ref;
}
