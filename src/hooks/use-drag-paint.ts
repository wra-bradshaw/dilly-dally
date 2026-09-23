import { useMemo, useState } from "react";

export type PaintMode = "auto" | "add" | "remove";

function linearRange<T>(values: T[], from: T, to: T): T[] {
	const a = values.indexOf(from);
	const b = values.indexOf(to);
	if (a === -1 || b === -1) return [];
	const [lo, hi] = a < b ? [a, b] : [b, a];
	return values.slice(lo, hi + 1);
}

export interface DragPaintOptions<T> {
	values: T[];
	selected: Set<T>;
	onCommit: (next: Set<T>) => void;
	mode?: PaintMode;
	range?: (values: T[], from: T, to: T) => T[];
}

export interface DragPaintApi<T> {
	painting: boolean;
	preview: Set<T>;
	onPointerDown: (value: T) => void;
	onPointerEnter: (value: T) => void;
	onPointerUp: (finalValue?: T) => void;
	onPointerCancel: () => void;
}

export function useDragPaint<T>(options: DragPaintOptions<T>): DragPaintApi<T> {
	const {
		mode = "auto",
		onCommit,
		range = linearRange,
		selected,
		values,
	} = options;
	const [drag, setDrag] = useState<{
		anchor: T;
		current: T;
		paint: boolean;
	} | null>(null);

	const preview = useMemo(() => {
		if (!drag) return selected;
		const next = new Set(selected);
		for (const v of range(values, drag.anchor, drag.current)) {
			if (drag.paint) next.add(v);
			else next.delete(v);
		}
		return next;
	}, [drag, range, selected, values]);

	return {
		onPointerDown: (value: T) => {
			const paint =
				mode === "add"
					? true
					: mode === "remove"
						? false
						: !selected.has(value);
			setDrag({ anchor: value, current: value, paint });
		},
		onPointerEnter: (value: T) => {
			if (drag) setDrag({ ...drag, current: value });
		},
		onPointerUp: (finalValue?: T) => {
			if (!drag) return;
			const current = finalValue === undefined ? drag.current : finalValue;
			const next = new Set(selected);
			for (const v of range(values, drag.anchor, current)) {
				if (drag.paint) next.add(v);
				else next.delete(v);
			}
			onCommit(next);
			setDrag(null);
		},
		onPointerCancel: () => {
			if (drag) setDrag(null);
		},
		painting: drag !== null,
		preview,
	};
}
