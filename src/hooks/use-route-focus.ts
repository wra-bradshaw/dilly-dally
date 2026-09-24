import { useEffect, useRef } from "react";

export function useRouteFocus(routeKey: string, selector = "main h1"): void {
	const first = useRef(true);
	useEffect(() => {
		void routeKey;
		if (first.current) {
			first.current = false;
			return;
		}
		const target = document.querySelector<HTMLElement>(selector);
		if (!target) return;
		target.focus({ preventScroll: false });
	}, [routeKey, selector]);
}
