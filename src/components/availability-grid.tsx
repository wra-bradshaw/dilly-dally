import { useMemo, useRef, useState } from "react";
import { useDragPaint } from "#/hooks/use-drag-paint";
import { paintTargetFromPoint } from "#/lib/paint-target";
import { cn } from "#/lib/utils";
import { type GridColumn, gridRectangleIds } from "./grid-model";
import { TimeGrid } from "./time-grid";

interface AvailabilityGridProps {
	columns: GridColumn[];
	selected: Set<string>;
	onCommit: (next: Set<string>) => void;
	disabled?: boolean;
}

export function AvailabilityGrid({
	columns,
	disabled,
	onCommit,
	selected,
}: AvailabilityGridProps) {
	const ref = useRef<HTMLTableElement>(null);
	const suppressClick = useRef(false);
	const clearTimer = useRef<number | undefined>(undefined);
	const values = useMemo(
		() => columns.flatMap((c) => c.cells.map((cell) => cell.id)),
		[columns],
	);
	const range = useMemo(
		() => (_values: string[], from: string, to: string) =>
			gridRectangleIds(columns, from, to),
		[columns],
	);
	const drag = useDragPaint({
		onCommit,
		range,
		selected,
		values,
	});

	const pos = useMemo(() => {
		const m = new Map<string, { c: number; r: number }>();
		columns.forEach((col, c) => {
			col.cells.forEach((cell, r) => {
				m.set(cell.id, { c, r });
			});
		});
		return m;
	}, [columns]);
	const [focusId, setFocusId] = useState<string | null>(null);
	const roving = focusId ?? values[0] ?? null;

	const focusCell = (id: string) => {
		setFocusId(id);
		ref.current
			?.querySelector<HTMLButtonElement>(`[data-cell="${id}"]`)
			?.focus();
	};

	const moveFocus = (id: string, dc: number, dr: number) => {
		const p = pos.get(id);
		if (!p) return;
		const nc = Math.min(columns.length - 1, Math.max(0, p.c + dc));
		const rows = columns[nc]?.cells ?? [];
		const nr = Math.min(rows.length - 1, Math.max(0, p.r + dr));
		const target = rows[nr]?.id;
		if (target) focusCell(target);
	};

	const onGridKeyDown = (e: React.KeyboardEvent) => {
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
	};

	const toggleCell = (id: string, detail: number) => {
		if (detail !== 0) {
			if (suppressClick.current) suppressClick.current = false;
			return;
		}
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onCommit(next);
	};

	const capture = (e: React.PointerEvent) => {
		try {
			(ref.current as unknown as HTMLElement)?.setPointerCapture?.(e.pointerId);
		} catch {}
	};

	const moveToPoint = (clientX: number, clientY: number) => {
		if (!drag.painting) return;
		const id = paintTargetFromPoint(clientX, clientY, "data-cell");
		if (id) drag.onPointerEnter(id);
	};

	const finishAtPoint = (clientX: number, clientY: number) => {
		const id = paintTargetFromPoint(clientX, clientY, "data-cell");
		if (id) {
			suppressClick.current = true;
			if (clearTimer.current !== undefined)
				window.clearTimeout(clearTimer.current);
			clearTimer.current = window.setTimeout(() => {
				suppressClick.current = false;
				clearTimer.current = undefined;
			}, 300);
		}
		drag.onPointerUp(id ?? undefined);
	};

	return (
		<div>
			<div className={cn("overflow-x-auto pb-2", disabled && "opacity-60")}>
				<TimeGrid
					columns={columns}
					onKeyDown={onGridKeyDown}
					onPointerCancel={drag.onPointerCancel}
					onPointerMove={(e) => moveToPoint(e.clientX, e.clientY)}
					onPointerUp={(e) => finishAtPoint(e.clientX, e.clientY)}
					renderCell={(cell, ctx) => (
						<button
							aria-label={`${ctx.segment.label} ${cell.label}`}
							aria-pressed={drag.preview.has(cell.id)}
							className={cn(
								"block h-5 w-full border-r border-b border-l first:border-t",
								drag.preview.has(cell.id)
									? "border-emerald-700 bg-emerald-400"
									: "border-rose-200 bg-rose-100 hover:bg-rose-200",
								cell.hourStart && "border-t border-t-rose-300",
								ctx.afterBreak && "border-t-2 border-t-foreground/50",
								disabled && "pointer-events-none",
							)}
							data-cell={cell.id}
							disabled={disabled}
							onClick={(e) => toggleCell(cell.id, e.detail)}
							onFocus={() => setFocusId(cell.id)}
							onPointerDown={(e) => {
								if (disabled) return;
								if (e.button !== 0 && e.pointerType === "mouse") return;
								if (clearTimer.current !== undefined) {
									window.clearTimeout(clearTimer.current);
									clearTimer.current = undefined;
								}
								suppressClick.current = false;
								capture(e);
								drag.onPointerDown(cell.id);
							}}
							onPointerEnter={() => {
								if (disabled) return;
								drag.onPointerEnter(cell.id);
							}}
							tabIndex={cell.id === roving ? 0 : -1}
							type="button"
						/>
					)}
					tableClassName="touch-none"
					tableLabel="Your availability. Click or drag to paint times you are free. Use arrow keys to move, space to toggle."
					tableRef={ref}
				/>
			</div>
		</div>
	);
}
