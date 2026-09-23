import { useMemo, useState } from "react";
import { identityParse, usePaintSurface } from "#/hooks/use-paint-surface";
import { cn } from "#/lib/utils";
import {
	buildGridPos,
	type GridColumn,
	gridRectangleIdsFromPos,
} from "./grid-model";
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
	const values = useMemo(
		() => columns.flatMap((c) => c.cells.map((cell) => cell.id)),
		[columns],
	);
	const pos = useMemo(() => buildGridPos(columns), [columns]);
	const range = useMemo(
		() => (_values: string[], from: string, to: string) =>
			gridRectangleIdsFromPos(columns, pos, from, to),
		[columns, pos],
	);
	const surface = usePaintSurface<string, HTMLTableElement>({
		attr: "data-cell",
		disabled,
		onCommit,
		parse: identityParse,
		range,
		selected,
		values,
	});

	const [focusId, setFocusId] = useState<string | null>(null);
	const roving = focusId ?? values[0] ?? null;

	const focusCell = (id: string) => {
		setFocusId(id);
		surface.containerRef.current
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

	return (
		<div>
			<div className={cn("overflow-x-auto pb-2", disabled && "opacity-60")}>
				<TimeGrid
					columns={columns}
					onKeyDown={onGridKeyDown}
					onPointerCancel={surface.onPointerCancel}
					onPointerMove={surface.onPointerMove}
					onPointerUp={surface.onPointerUp}
					renderCell={(cell, ctx) => (
						<button
							aria-label={`${ctx.segment.label} ${cell.label}`}
							aria-pressed={surface.preview.has(cell.id)}
							className={cn(
								"block h-6 w-full border-r border-b border-l first:border-t",
								surface.preview.has(cell.id)
									? "border-emerald-700 bg-emerald-400"
									: "border-rose-200 bg-rose-100 hover:bg-rose-200",
								cell.hourStart && "border-t border-t-rose-300",
								ctx.afterBreak && "border-t-2 border-t-foreground/50",
								disabled && "pointer-events-none",
							)}
							data-cell={cell.id}
							disabled={disabled}
							onClick={(e) => surface.toggle(cell.id, e.detail)}
							onFocus={() => setFocusId(cell.id)}
							onPointerDown={(e) => {
								if (disabled) return;
								if (e.button !== 0 && e.pointerType === "mouse") return;
								surface.start(cell.id, e);
							}}
							onPointerEnter={() => {
								if (disabled) return;
								surface.hover(cell.id);
							}}
							tabIndex={cell.id === roving ? 0 : -1}
							type="button"
						/>
					)}
					tableClassName={surface.painting ? "touch-none" : undefined}
					tableLabel="Your availability. Click or drag to paint times you are free. Use arrow keys to move, space to toggle."
					tableRef={surface.containerRef}
				/>
			</div>
		</div>
	);
}
