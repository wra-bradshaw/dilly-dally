import { useMemo, useRef, useState } from "react";
import { useGridKeyboardNav } from "#/hooks/use-grid-keyboard-nav";
import { cn } from "#/lib/utils";
import { buildGridPos, formatViewerSlot, type GridColumn } from "./grid-model";
import { TimeGrid } from "./time-grid";

interface CellCount {
	count: number;
	names: string[];
}

export const HEATMAP_FILL_RGB = [16, 122, 87] as const;

export function heatmapAlpha(count: number, max: number): number {
	if (!(max > 0)) return 0.15;
	const ratio = Math.min(1, Math.max(0, count / max));
	return Math.min(0.6, 0.15 + 0.75 * ratio);
}

export function heatmapAnnounce(signedIn: boolean): boolean {
	return !signedIn;
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
					announce={announce}
					columns={columns}
					onKeyDown={onHeatmapKeyDown}
					renderCell={(cell, ctx) => (
						<button
							aria-label={`${ctx.segment.label} ${cell.label}: ${counts.get(cell.id)?.count ?? 0} of ${total} available`}
							className={cn(
								"block h-6 w-full cursor-default border-r border-b border-l text-[10px] leading-6 font-semibold first:border-t",
								(counts.get(cell.id)?.count ?? 0) === 0
									? "border-rose-200 bg-rose-50 text-rose-400 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-300/70"
									: "border-emerald-800 text-emerald-950 underline decoration-emerald-900/40 underline-offset-2 dark:border-emerald-600 dark:text-emerald-100",
								ctx.afterBreak && "border-t-2 border-t-foreground/50",
								hovered === cell.id && "ring-2 ring-inset ring-primary",
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
							style={
								(counts.get(cell.id)?.count ?? 0) === 0
									? undefined
									: {
											backgroundColor: `rgba(${HEATMAP_FILL_RGB[0]}, ${HEATMAP_FILL_RGB[1]}, ${HEATMAP_FILL_RGB[2]}, ${heatmapAlpha(counts.get(cell.id)?.count ?? 0, max)})`,
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
								<div className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
									Available
								</div>
								<div className="text-xs">{info.names.join(", ")}</div>
							</div>
						)}
						{unavailable.length > 0 && (
							<div className="mt-2">
								<div className="text-xs font-medium text-rose-800 dark:text-rose-300">
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
