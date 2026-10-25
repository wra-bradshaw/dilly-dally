import { useCallback, useRef, useState } from "react";

export function usePendingIds<T>() {
	const [pendingIds, setPendingIds] = useState<T | null>(null);
	const versionRef = useRef(0);
	const commit = useCallback((next: T) => {
		versionRef.current += 1;
		setPendingIds(next);
		return versionRef.current;
	}, []);
	const resolve = useCallback((version: number) => {
		if (version === versionRef.current) setPendingIds(null);
	}, []);
	const clear = useCallback(() => {
		setPendingIds(null);
	}, []);
	const getVersion = useCallback(() => versionRef.current, []);
	return { clear, commit, getVersion, pendingIds, resolve };
}
