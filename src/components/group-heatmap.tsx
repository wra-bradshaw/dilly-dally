import { useMemo, useRef, useState } from "react";
import { cn } from "#/lib/utils";
import { buildGridPos, formatViewerSlot, type GridColumn } from "./grid-model";
import { TimeGrid } from "./time-grid";

interface CellCount {
	count: number;
	names: string[];
}

interface GroupHeatmapProps {
	columns: GridColumn[];
	counts: Map<string, CellCount>;
	total: number;
	allNames: string[];
	eventTimezone?: string;
	viewTimezone?: string;
}

export function GroupHeatmap({
	allNames,
	columns,
	counts,
	eventTimezone,
	total,
	viewTimezone,
}: GroupHeatmapProps) {
	const [hovered, setHovered] = useState<string | null>(null);
	const tableRef = useRef<HTMLTableElement>(null);
	const values = useMemo(
		() => columns.flatMap((c) => c.cells.map((cell) => cell.id)),
		[columns],
	);
	const pos = useMemo(() => buildGridPos(columns), [columns]);
	const [focusId, setFocusId] = useState<string | null>(null);
	const roving = focusId ?? values[0] ?? null;

	const focusCell = (id: string) => {
		setFocusId(id);
		tableRef.current
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
	const max = useMemo(() => {
		let top = 1;
		for (const c of counts.values()) {
			if (c.count > top) top = c.count;
		}
		return top;
	}, [counts]);
	const info = hovered ? counts.get(hovered) : undefined;
	const unavailable = useMemo(
		() => (info ? allNames.filter((n) => !info.names.includes(n)) : []),
		[allNames, info],
	);
	const hoveredDisplay =
		hovered && eventTimezone && viewTimezone
			? formatViewerSlot(hovered, eventTimezone, viewTimezone)
			: hovered;

	return (
		<div className="flex flex-col gap-3 lg:flex-row">
			<div className="overflow-x-auto pb-2">
				<TimeGrid
					columns={columns}
					onKeyDown={onGridKeyDown}
					renderCell={(cell, ctx) => (
						<button
							aria-label={`${ctx.segment.label} ${cell.label}: ${counts.get(cell.id)?.count ?? 0} of ${total} available`}
							className={cn(
								"block h-6 w-full cursor-default border-r border-b border-l text-[10px] leading-6 font-semibold first:border-t",
								(counts.get(cell.id)?.count ?? 0) === 0
									? "border-rose-200 bg-rose-50 text-rose-400"
									: "border-emerald-800 text-emerald-950 underline decoration-emerald-900/40 underline-offset-2",
								ctx.afterBreak && "border-t-2 border-t-foreground/50",
								hovered === cell.id && "ring-2 ring-primary",
							)}
							data-cell={cell.id}
							onClick={() => setHovered(cell.id)}
							onFocus={() => {
								setFocusId(cell.id);
								setHovered(cell.id);
							}}
							onMouseEnter={() => setHovered(cell.id)}
							onMouseLeave={() => setHovered(null)}
							style={
								(counts.get(cell.id)?.count ?? 0) === 0
									? undefined
									: {
											backgroundColor: `rgba(16, 122, 87, ${0.15 + (0.75 * (counts.get(cell.id)?.count ?? 0)) / max})`,
										}
							}
							tabIndex={cell.id === roving ? 0 : -1}
							type="button"
						>
							{(counts.get(cell.id)?.count ?? 0) > 0
								? String(counts.get(cell.id)?.count)
								: ""}
						</button>
					)}
					tableLabel="Group availability. Darker green means more people are free. Counts are shown as numbers."
					tableRef={tableRef}
				/>
			</div>
			<div
				aria-live="polite"
				className="min-h-24 w-full shrink-0 rounded-md border p-3 text-sm lg:w-64"
			>
				{info && hovered ? (
					<div>
						<div className="font-semibold">
							{info.count}/{total} available
						</div>
						<div className="mt-1 text-xs text-muted-foreground" title={hovered}>
							{hoveredDisplay}
						</div>
						{info.names.length > 0 && (
							<div className="mt-2">
								<div className="text-xs font-medium text-emerald-800">
									Available
								</div>
								<div className="text-xs">{info.names.join(", ")}</div>
							</div>
						)}
						{unavailable.length > 0 && (
							<div className="mt-2">
								<div className="text-xs font-medium text-rose-800">
									Unavailable
								</div>
								<div className="text-xs">{unavailable.join(", ")}</div>
							</div>
						)}
					</div>
				) : (
					<div className="text-xs text-muted-foreground">
						Hover or tap a time slot to see who is available. Darker green means
						more people.
					</div>
				)}
			</div>
		</div>
	);
}
