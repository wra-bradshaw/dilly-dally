import { useEffect, useRef } from "react";

export function useHydrateOnce<T>(
	value: T | null | undefined,
	apply: (value: T) => void,
): void {
	const applyRef = useRef(apply);
	useEffect(() => {
		applyRef.current = apply;
	});
	const mountValueRef = useRef(value);
	const appliedRef = useRef(false);
	useEffect(() => {
		if (value === null || value === undefined) return;
		if (appliedRef.current) return;
		if (mountValueRef.current !== null && mountValueRef.current !== undefined) {
			appliedRef.current = true;
			return;
		}
		appliedRef.current = true;
		applyRef.current(value);
	}, [value]);
}
