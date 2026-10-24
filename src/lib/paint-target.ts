export function paintTargetFromPoint(
	clientX: number,
	clientY: number,
	attr: string,
): string | null {
	const el = document
		.elementFromPoint(clientX, clientY)
		?.closest?.(`[${attr}]`);
	if (!el) return null;
	return el.getAttribute(attr);
}

export const PAINT_EDGE_PX = 32;

function scrollSpeed(depth: number): number {
	return Math.max(4, Math.round((24 * depth) / PAINT_EDGE_PX));
}

export function edgeScrollDelta(
	pos: number,
	start: number,
	end: number,
	scrollPos: number,
	scrollSize: number,
	clientSize: number,
): number {
	if (scrollSize <= clientSize + 1) return 0;
	const max = scrollSize - clientSize;
	const before = Math.min(Math.max(pos - start, 0), PAINT_EDGE_PX);
	if (before < PAINT_EDGE_PX && scrollPos > 0) {
		return -scrollSpeed(PAINT_EDGE_PX - before);
	}
	const after = Math.min(Math.max(end - pos, 0), PAINT_EDGE_PX);
	if (after < PAINT_EDGE_PX && scrollPos < max) {
		return scrollSpeed(PAINT_EDGE_PX - after);
	}
	return 0;
}

export function nearestOverflowAncestor(
	start: HTMLElement | null,
	axis: "x" | "y" = "x",
): HTMLElement | null {
	let el = start?.parentElement ?? null;
	for (let i = 0; i < 6 && el; i++) {
		const style = getComputedStyle(el);
		const overflow = axis === "y" ? style.overflowY : style.overflowX;
		const scrollable = overflow === "auto" || overflow === "scroll";
		if (axis === "y") {
			if (scrollable && el.scrollHeight > el.clientHeight + 1) return el;
		} else if (scrollable && el.scrollWidth > el.clientWidth + 1) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}
