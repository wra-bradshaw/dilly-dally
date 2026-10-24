import { type RefObject, useCallback, useRef } from "react";
import {
	edgeScrollDelta,
	nearestOverflowAncestor,
	paintTargetFromPoint,
} from "#/lib/paint-target";
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
	pageScroll?: boolean;
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

export const TOUCH_PAINT_DELAY_MS = 300;
const TOUCH_SLOP_PX = 12;

interface PendingTouch<T> {
	value: T;
	x: number;
	y: number;
	timer: ReturnType<typeof setTimeout>;
	target: HTMLElement | null;
	pointerId: number | undefined;
	el: HTMLElement | null;
}

export function usePaintSurface<T, E extends HTMLElement = HTMLElement>(
	options: PaintSurfaceOptions<T, E>,
) {
	const {
		attr,
		containerRef: externalRef,
		disabled,
		onCommit,
		pageScroll = true,
		parse,
		range,
		selected,
		values,
	} = options;
	const internalRef = useRef<E | null>(null);
	const containerRef = externalRef ?? internalRef;
	const drag = useDragPaint({ onCommit, range, selected, values });
	const pendingRef = useRef<PendingTouch<T> | null>(null);
	const touchPaintingRef = useRef(false);
	const activePointerRef = useRef<number | null>(null);
	const attachedElRef = useRef<HTMLElement | null>(null);

	const isForeignPointer = useCallback((pointerId: number | undefined) => {
		const active = activePointerRef.current;
		return active !== null && pointerId !== undefined && pointerId !== active;
	}, []);

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

	const onNativeTouchMove = useCallback((e: TouchEvent) => {
		if (touchPaintingRef.current && e.cancelable) e.preventDefault();
	}, []);

	const detachTouchMove = useCallback(() => {
		const el = attachedElRef.current;
		attachedElRef.current = null;
		el?.removeEventListener("touchmove", onNativeTouchMove);
	}, [onNativeTouchMove]);

	const clearPending = useCallback(() => {
		const pending = pendingRef.current;
		pendingRef.current = null;
		if (pending) clearTimeout(pending.timer);
		detachTouchMove();
	}, [detachTouchMove]);

	const beginTouchPaint = useCallback(() => {
		const pending = pendingRef.current;
		pendingRef.current = null;
		if (!pending || disabled) {
			detachTouchMove();
			activePointerRef.current = null;
			return;
		}
		if (pending.el && !pending.el.isConnected) {
			detachTouchMove();
			activePointerRef.current = null;
			return;
		}
		touchPaintingRef.current = true;
		pending.target?.focus({ preventScroll: true });
		try {
			pending.el?.setPointerCapture?.(pending.pointerId);
		} catch {}
		navigator.vibrate?.(10);
		drag.onPointerDown(pending.value);
	}, [detachTouchMove, disabled, drag]);

	const start = useCallback(
		(value: T, e: React.PointerEvent) => {
			if (disabled) return;
			if (e.pointerType === "touch" && e.isPrimary === false) return;
			if (
				(pendingRef.current || touchPaintingRef.current || drag.painting) &&
				isForeignPointer(e.pointerId)
			) {
				return;
			}
			if (e.pointerType === "touch") {
				clearPending();
				const el =
					(containerRef.current as unknown as HTMLElement | null) ?? null;
				const timer = setTimeout(beginTouchPaint, TOUCH_PAINT_DELAY_MS);
				activePointerRef.current = e.pointerId ?? null;
				pendingRef.current = {
					el,
					pointerId: e.pointerId,
					target: (e.currentTarget as unknown as HTMLElement | null) ?? null,
					timer,
					value,
					x: e.clientX,
					y: e.clientY,
				};
				if (el) {
					attachedElRef.current = el;
					el.addEventListener("touchmove", onNativeTouchMove, {
						passive: false,
					});
				}
				return;
			}
			clearPending();
			activePointerRef.current = e.pointerId ?? null;
			(e.currentTarget as unknown as HTMLElement | null)?.focus?.({
				preventScroll: true,
			});
			capture(e);
			drag.onPointerDown(value);
		},
		[
			beginTouchPaint,
			capture,
			clearPending,
			containerRef,
			disabled,
			drag,
			isForeignPointer,
			onNativeTouchMove,
		],
	);

	const hover = useCallback(
		(value: T, e?: React.PointerEvent) => {
			if (disabled) return;
			if (e && isForeignPointer(e.pointerId)) return;
			drag.onPointerEnter(value);
		},
		[disabled, drag, isForeignPointer],
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
			if (disabled || !drag.painting) return;
			const el = containerRef.current as unknown as HTMLElement | null;
			const scroller = nearestOverflowAncestor(el, "x");
			if (scroller) {
				const rect = scroller.getBoundingClientRect();
				const dx = edgeScrollDelta(
					clientX,
					rect.left,
					rect.right,
					scroller.scrollLeft,
					scroller.scrollWidth,
					scroller.clientWidth,
				);
				if (dx !== 0) scroller.scrollLeft += dx;
			}
			const vScroller = nearestOverflowAncestor(el, "y");
			if (
				vScroller &&
				vScroller !== document.body &&
				vScroller !== document.documentElement
			) {
				const rect = vScroller.getBoundingClientRect();
				const dy = edgeScrollDelta(
					clientY,
					rect.top,
					rect.bottom,
					vScroller.scrollTop,
					vScroller.scrollHeight,
					vScroller.clientHeight,
				);
				if (dy !== 0) vScroller.scrollTop += dy;
			} else if (pageScroll && typeof window.scrollBy === "function") {
				const doc = document.scrollingElement;
				if (doc) {
					const dy = edgeScrollDelta(
						clientY,
						0,
						window.innerHeight,
						window.scrollY,
						doc.scrollHeight,
						window.innerHeight,
					);
					if (dy !== 0) window.scrollBy(0, dy);
				}
			}
			const raw = paintTargetFromPoint(clientX, clientY, attr);
			if (raw === null) return;
			const value = parse(raw);
			if (value !== undefined) drag.onPointerEnter(value);
		},
		[attr, containerRef, disabled, drag, pageScroll, parse],
	);

	const finishAtPoint = useCallback(
		(clientX: number, clientY: number) => {
			if (disabled) return;
			const raw = paintTargetFromPoint(clientX, clientY, attr);
			const target = raw === null ? undefined : parse(raw);
			drag.onPointerUp(target);
		},
		[attr, disabled, drag, parse],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			const pending = pendingRef.current;
			if (pending) {
				if (isForeignPointer(e.pointerId)) return;
				const dx = e.clientX - pending.x;
				const dy = e.clientY - pending.y;
				if (dx * dx + dy * dy > TOUCH_SLOP_PX * TOUCH_SLOP_PX) {
					clearPending();
					activePointerRef.current = null;
				}
				return;
			}
			if (isForeignPointer(e.pointerId)) {
				return;
			}
			moveToPoint(e.clientX, e.clientY);
		},
		[clearPending, isForeignPointer, moveToPoint],
	);

	const cancel = useCallback(
		(e?: React.PointerEvent) => {
			if (e && isForeignPointer(e.pointerId)) return;
			clearPending();
			touchPaintingRef.current = false;
			activePointerRef.current = null;
			detachTouchMove();
			drag.onPointerCancel();
		},
		[clearPending, detachTouchMove, drag, isForeignPointer],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (disabled) {
				cancel();
				return;
			}
			const pending = pendingRef.current;
			if (pending) {
				if (isForeignPointer(e.pointerId)) return;
				pendingRef.current = null;
				clearTimeout(pending.timer);
				detachTouchMove();
				activePointerRef.current = null;
				pending.target?.focus({ preventScroll: true });
				toggle(pending.value, 0);
				return;
			}
			if (isForeignPointer(e.pointerId)) {
				return;
			}
			touchPaintingRef.current = false;
			activePointerRef.current = null;
			detachTouchMove();
			finishAtPoint(e.clientX, e.clientY);
		},
		[
			cancel,
			detachTouchMove,
			disabled,
			finishAtPoint,
			isForeignPointer,
			toggle,
		],
	);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") cancel();
		},
		[cancel],
	);

	return {
		containerRef,
		hover,
		onKeyDown,
		onPointerCancel: cancel,
		onPointerMove,
		onPointerUp,
		painting: drag.painting,
		preview: drag.preview,
		start,
		toggle,
	};
}
