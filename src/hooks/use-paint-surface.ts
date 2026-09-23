import { type RefObject, useCallback, useRef } from "react";
import { paintTargetFromPoint } from "#/lib/paint-target";
import { useDragPaint } from "./use-drag-paint";

export interface PaintSurfaceOptions<T, E extends HTMLElement = HTMLElement> {
	attr: string;
	parse: (raw: string) => T | undefined;
	values: T[];
	selected: Set<T>;
	onCommit: (next: Set<T>) => void;
	range?: (values: T[], from: T, to: T) => T[];
	disabled?: boolean;
	containerRef?: RefObject<E | null>;
}

export function identityParse(raw: string): string {
	return raw;
}

interface ToggleKey {
	altKey: boolean;
	ctrlKey: boolean;
	key: string;
	metaKey: boolean;
	repeat: boolean;
}

export function shouldSuppressToggleKey(e: ToggleKey): boolean {
	if (e.key !== " " && e.key !== "Enter") return false;
	return Boolean(e.repeat || e.ctrlKey || e.metaKey || e.altKey);
}

export function suppressToggleKey<E extends { preventDefault(): void }>(
	e: ToggleKey & E,
): boolean {
	if (!shouldSuppressToggleKey(e)) return false;
	e.preventDefault();
	return true;
}

export function usePaintSurface<T, E extends HTMLElement = HTMLElement>(
	options: PaintSurfaceOptions<T, E>,
) {
	const {
		attr,
		containerRef: externalRef,
		disabled,
		onCommit,
		parse,
		range,
		selected,
		values,
	} = options;
	const internalRef = useRef<E | null>(null);
	const containerRef = externalRef ?? internalRef;
	const drag = useDragPaint({ onCommit, range, selected, values });

	const capture = useCallback(
		(e: React.PointerEvent) => {
			try {
				(
					containerRef.current as unknown as HTMLElement | null
				)?.setPointerCapture?.(e.pointerId);
			} catch {}
		},
		[containerRef],
	);

	const start = useCallback(
		(value: T, e: React.PointerEvent) => {
			if (disabled) return;
			(e.currentTarget as unknown as HTMLElement | null)?.focus?.({
				preventScroll: true,
			});
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
			if (detail !== 0) return;
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
