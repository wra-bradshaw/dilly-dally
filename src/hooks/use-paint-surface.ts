import { useCallback, useRef } from "react";
import { paintTargetFromPoint } from "#/lib/paint-target";
import { useDragPaint } from "./use-drag-paint";

export interface PaintSurfaceOptions<T> {
	attr: string;
	parse: (raw: string) => T | undefined;
	values: T[];
	selected: Set<T>;
	onCommit: (next: Set<T>) => void;
	range?: (values: T[], from: T, to: T) => T[];
	disabled?: boolean;
}

export function identityParse(raw: string): string {
	return raw;
}

export function usePaintSurface<T, E extends HTMLElement = HTMLElement>(
	options: PaintSurfaceOptions<T>,
) {
	const { attr, disabled, onCommit, parse, range, selected, values } = options;
	const containerRef = useRef<E | null>(null);
	const suppressClick = useRef(false);
	const clearTimer = useRef<number | undefined>(undefined);
	const drag = useDragPaint({ onCommit, range, selected, values });

	const capture = useCallback((e: React.PointerEvent) => {
		try {
			(
				containerRef.current as unknown as HTMLElement | null
			)?.setPointerCapture?.(e.pointerId);
		} catch {}
	}, []);

	const start = useCallback(
		(value: T, e: React.PointerEvent) => {
			if (disabled) return;
			if (clearTimer.current !== undefined) {
				window.clearTimeout(clearTimer.current);
				clearTimer.current = undefined;
			}
			suppressClick.current = false;
			capture(e);
			drag.onPointerDown(value);
		},
		[capture, disabled, drag],
	);

	const hover = useCallback(
		(value: T) => {
			if (disabled) return;
			drag.onPointerEnter(value);
		},
		[disabled, drag],
	);

	const toggle = useCallback(
		(value: T, detail: number) => {
			if (disabled) return;
			if (detail !== 0) {
				if (suppressClick.current) suppressClick.current = false;
				return;
			}
			const next = new Set(selected);
			if (next.has(value)) next.delete(value);
			else next.add(value);
			onCommit(next);
		},
		[disabled, onCommit, selected],
	);

	const moveToPoint = useCallback(
		(clientX: number, clientY: number) => {
			if (!drag.painting) return;
			const raw = paintTargetFromPoint(clientX, clientY, attr);
			if (raw === null) return;
			const value = parse(raw);
			if (value !== undefined) drag.onPointerEnter(value);
		},
		[attr, drag, parse],
	);

	const finishAtPoint = useCallback(
		(clientX: number, clientY: number) => {
			const raw = paintTargetFromPoint(clientX, clientY, attr);
			const target = raw === null ? undefined : parse(raw);
			if (target !== undefined) {
				suppressClick.current = true;
				if (clearTimer.current !== undefined)
					window.clearTimeout(clearTimer.current);
				clearTimer.current = window.setTimeout(() => {
					suppressClick.current = false;
					clearTimer.current = undefined;
				}, 300);
			}
			drag.onPointerUp(target);
		},
		[attr, drag, parse],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			moveToPoint(e.clientX, e.clientY);
		},
		[moveToPoint],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			finishAtPoint(e.clientX, e.clientY);
		},
		[finishAtPoint],
	);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") drag.onPointerCancel();
		},
		[drag],
	);

	return {
		cancelPaint: drag.onPointerCancel,
		containerRef,
		hover,
		onKeyDown,
		onPointerCancel: drag.onPointerCancel,
		onPointerMove,
		onPointerUp,
		painting: drag.painting,
		preview: drag.preview,
		start,
		toggle,
	};
}
