import { useId, useMemo, useRef, useState } from "react";
import { useGridKeyboardNav } from "#/hooks/use-grid-keyboard-nav";
import { cn } from "#/lib/utils";
import { buildGridPos, formatViewerSlot, type GridColumn } from "./grid-model";
import { TimeGrid } from "./time-grid";

interface CellCount {
	count: number;
	names: string[];
}

export function heatmapAnnounce(signedIn: boolean): boolean {
	return !signedIn;
}

export function heatmapFill(count: number, total: number): string {
	if (!(count > 0)) {
		return "border-rose-600 bg-rose-100 dark:border-rose-400 dark:bg-rose-950/40";
	}
	const ratio = total > 0 ? count / total : 0;
	if (ratio >= 1) {
		return "border-emerald-800 bg-emerald-400 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-700 dark:text-emerald-100";
	}
	if (ratio >= 0.6) {
		return "border-emerald-800 bg-emerald-300 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-800 dark:text-emerald-100";
	}
	if (ratio >= 0.3) {
		return "border-emerald-800 bg-emerald-200 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-900 dark:text-emerald-100";
	}
	return "border-emerald-800 bg-emerald-100 text-emerald-950 dark:border-emerald-300 dark:bg-emerald-950 dark:text-emerald-100";
}

interface GroupHeatmapProps {
	columns: GridColumn[];
	counts: Map<string, CellCount>;
	total: number;
	allNames: string[];
	eventTimezone?: string;
	viewTimezone?: string;
	announce?: boolean;
}

export function GroupHeatmap({
	allNames,
	announce = true,
	columns,
	counts,
	eventTimezone,
	total,
	viewTimezone,
}: GroupHeatmapProps) {
	const [hovered, setHovered] = useState<string | null>(null);
	const [focusedId, setFocusedId] = useState<string | null>(null);
	const tapped = useRef<string | null>(null);
	const tableRef = useRef<HTMLTableElement>(null);
	const rawDetailId = useId();
	const detailId = rawDetailId.replace(/[^a-zA-Z0-9_-]/g, "");
	const pos = useMemo(() => buildGridPos(columns), [columns]);
	const { onGridKeyDown, roving, setFocusId } = useGridKeyboardNav(
		columns,
		pos,
		tableRef,
	);
	const onHeatmapKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") {
			tapped.current = null;
			setFocusedId(null);
			setHovered(null);
		}
		onGridKeyDown(e);
	};
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
					announce={announce}
					columns={columns}
					onKeyDown={onHeatmapKeyDown}
					renderCell={(cell, ctx) => (
						<button
							aria-describedby={detailId}
							aria-label={`${ctx.segment.label} ${cell.label}: ${counts.get(cell.id)?.count ?? 0} of ${total} available`}
							className={cn(
								"block h-6 min-h-6 w-full cursor-default border-r border-b border-l text-[10px] leading-6 font-semibold transition-colors motion-reduce:transition-none first:border-t focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring forced-colors:focus-visible:outline-[Highlight]",
								heatmapFill(counts.get(cell.id)?.count ?? 0, total),
								ctx.afterBreak && "border-t-2 border-t-foreground/50",
								hovered === cell.id && "ring-2 ring-inset ring-ring",
							)}
							data-cell={cell.id}
							onBlur={(e) => {
								setFocusedId(null);
								tapped.current = null;
								const next = (
									e.relatedTarget as unknown as HTMLElement | null
								)?.closest?.("[data-cell]");
								if (!next) setHovered(null);
							}}
							onClick={() => {
								tapped.current = cell.id;
								setHovered(cell.id);
							}}
							onFocus={() => {
								setFocusId(cell.id);
								setFocusedId(cell.id);
								setHovered(cell.id);
							}}
							onMouseEnter={() => {
								setHovered(cell.id);
							}}
							onPointerDown={(e) => {
								if (e.button !== 0 && e.pointerType === "mouse") return;
								(e.currentTarget as HTMLButtonElement).focus?.({
									preventScroll: true,
								});
							}}
							onMouseLeave={(e) => {
								const leaving = e.currentTarget.dataset.cell;
								if (leaving !== hovered) return;
								if (focusedId !== null) {
									setHovered(focusedId);
									return;
								}
								if (tapped.current !== null) {
									setHovered(tapped.current);
									return;
								}
								setHovered(null);
							}}
							tabIndex={cell.id === roving ? 0 : -1}
							type="button"
						>
							{(counts.get(cell.id)?.count ?? 0) > 0
								? String(counts.get(cell.id)?.count)
								: ""}
						</button>
					)}
					tableLabel="Group availability. Green means available. Counts are shown as numbers."
					tableRef={tableRef}
				/>
			</div>
			<div
				className="min-h-24 w-full shrink-0 rounded-md border p-3 text-sm lg:w-64"
				id={detailId}
			>
				{info && hovered ? (
					<div>
						<h3 className="font-semibold">
							{info.count}/{total} available
						</h3>
						<p className="mt-1 text-xs text-muted-foreground" title={hovered}>
							{hoveredDisplay}
						</p>
						{info.names.length > 0 && (
							<div className="mt-2">
								<h4 className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
									Available
								</h4>
								<ul className="text-xs">
									{info.names.map((name) => (
										<li key={name}>{name}</li>
									))}
								</ul>
							</div>
						)}
						{unavailable.length > 0 && (
							<div className="mt-2">
								<h4 className="text-xs font-medium text-rose-800 dark:text-rose-300">
									Unavailable
								</h4>
								<ul className="text-xs">
									{unavailable.map((name) => (
										<li key={name}>{name}</li>
									))}
								</ul>
							</div>
						)}
					</div>
				) : (
					<p className="text-xs text-muted-foreground">
						Hover or tap a time slot to see who is available.
					</p>
				)}
			</div>
		</div>
	);
}
