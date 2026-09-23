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
