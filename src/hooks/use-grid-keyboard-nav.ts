import { type RefObject, useCallback, useMemo, useState } from "react";
import type { GridColumn, GridPos } from "#/components/grid-model";

export function useGridKeyboardNav(
	columns: GridColumn[],
	pos: GridPos,
	tableRef: RefObject<HTMLTableElement | null>,
) {
	const values = useMemo(
		() => columns.flatMap((c) => c.cells.map((cell) => cell.id)),
		[columns],
	);
	const [focusId, setFocusId] = useState<string | null>(null);
	const roving = focusId ?? values[0] ?? null;

	const focusCell = useCallback(
		(id: string) => {
			setFocusId(id);
			tableRef.current
				?.querySelector<HTMLButtonElement>(`[data-cell="${id}"]`)
				?.focus();
		},
		[tableRef],
	);

	const moveFocus = useCallback(
		(id: string, dc: number, dr: number) => {
			const p = pos.get(id);
			if (!p) return;
			const nc = Math.min(columns.length - 1, Math.max(0, p.c + dc));
			const rows = columns[nc]?.cells ?? [];
			const nr = Math.min(rows.length - 1, Math.max(0, p.r + dr));
			const target = rows[nr]?.id;
			if (target) focusCell(target);
		},
		[columns, focusCell, pos],
	);

	const onGridKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const active = document.activeElement as HTMLElement | null;
			const id = active?.dataset?.cell ?? roving;
			if (!id) return;
			if (e.key === "ArrowRight") {
				e.preventDefault();
				moveFocus(id, 1, 0);
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				moveFocus(id, -1, 0);
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				moveFocus(id, 0, 1);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				moveFocus(id, 0, -1);
			}
		},
		[moveFocus, roving],
	);

	return { focusCell, moveFocus, onGridKeyDown, roving, setFocusId };
}
