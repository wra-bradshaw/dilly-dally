import { useState } from "react";
import { cn } from "#/lib/utils";
import type { GridColumn } from "./grid-model";

interface CellCount {
	count: number;
	names: string[];
}

interface GroupHeatmapProps {
	columns: GridColumn[];
	counts: Map<string, CellCount>;
	total: number;
	allNames: string[];
}

export function GroupHeatmap({
	allNames,
	columns,
	counts,
	total,
}: GroupHeatmapProps) {
	const [hovered, setHovered] = useState<string | null>(null);
	const max = Math.max(1, ...counts.values().map((c) => c.count));
	const info = hovered ? counts.get(hovered) : undefined;
	const unavailable = info
		? allNames.filter((n) => !info.names.includes(n))
		: [];
	const rowCount = columns[0]?.cells.length ?? 0;

	return (
		<div className="flex flex-col gap-3 lg:flex-row">
			<div className="overflow-x-auto pb-2">
				<table
					aria-label="Group availability. Darker green means more people are free."
					className="w-full border-collapse select-none"
				>
					<thead>
						<tr>
							<th className="w-16" scope="col">
								<span className="sr-only">Time</span>
							</th>
							{columns.map((col) => (
								<th className="min-w-9 px-0.5 pb-1" key={col.date} scope="col">
									<div className="text-xs font-semibold">{col.header}</div>
									<div className="text-[10px] font-normal text-muted-foreground">
										{col.subheader}
									</div>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{Array.from({ length: rowCount }, (_, r) => (
							<tr key={columns[0].cells[r].id}>
								<th
									className="pr-1 text-right align-top text-[10px] leading-5 font-normal text-muted-foreground"
									scope="row"
								>
									{columns[0].cells[r].hourStart
										? columns[0].cells[r].label
										: ""}
								</th>
								{columns.map((col) => {
									const cell = col.cells[r];
									const n = counts.get(cell.id)?.count ?? 0;
									return (
										<td className="p-0" key={cell.id}>
											<button
												aria-label={`${col.header} ${cell.label}: ${n} of ${total} available`}
												className={cn(
													"block h-5 w-full cursor-default border-r border-b border-l first:border-t",
													n === 0
														? "border-rose-200 bg-rose-50"
														: "border-emerald-800",
													hovered === cell.id && "ring-2 ring-primary",
												)}
												onClick={() => setHovered(cell.id)}
												onFocus={() => setHovered(cell.id)}
												onMouseEnter={() => setHovered(cell.id)}
												onMouseLeave={() => setHovered(null)}
												style={
													n === 0
														? undefined
														: {
																backgroundColor: `rgba(16, 122, 87, ${0.15 + (0.75 * n) / max})`,
															}
												}
												tabIndex={-1}
												type="button"
											/>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="min-h-24 w-full shrink-0 rounded-md border p-3 text-sm lg:w-64">
				{info && hovered ? (
					<div>
						<div className="font-semibold">
							{info.count}/{total} available
						</div>
						<div className="mt-1 text-xs text-muted-foreground">{hovered}</div>
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
