import { useMemo, useState } from "react";
import { cn } from "#/lib/utils";
import { formatViewerSlot, type GridColumn } from "./grid-model";
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
					renderCell={(cell, ctx) => (
						<button
							aria-label={`${ctx.segment.label} ${cell.label}: ${counts.get(cell.id)?.count ?? 0} of ${total} available`}
							className={cn(
								"block h-5 w-full cursor-default border-r border-b border-l first:border-t",
								(counts.get(cell.id)?.count ?? 0) === 0
									? "border-rose-200 bg-rose-50"
									: "border-emerald-800",
								ctx.afterBreak && "border-t-2 border-t-foreground/50",
								hovered === cell.id && "ring-2 ring-primary",
							)}
							onClick={() => setHovered(cell.id)}
							onFocus={() => setHovered(cell.id)}
							onMouseEnter={() => setHovered(cell.id)}
							onMouseLeave={() => setHovered(null)}
							style={
								(counts.get(cell.id)?.count ?? 0) === 0
									? undefined
									: {
											backgroundColor: `rgba(16, 122, 87, ${0.15 + (0.75 * (counts.get(cell.id)?.count ?? 0)) / max})`,
										}
							}
							tabIndex={-1}
							type="button"
						/>
					)}
					tableLabel="Group availability. Darker green means more people are free."
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
