import { Fragment, useMemo, useState } from "react";
import { cn } from "#/lib/utils";
import {
	formatViewerSlot,
	type GridColumn,
	getDayGaps,
	summarizeDates,
} from "./grid-model";

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
	const max = Math.max(1, ...counts.values().map((c) => c.count));
	const info = hovered ? counts.get(hovered) : undefined;
	const unavailable = info
		? allNames.filter((n) => !info.names.includes(n))
		: [];
	const gaps = useMemo(() => getDayGaps(columns), [columns]);
	const gapByAfter = useMemo(
		() => new Map(gaps.map((g) => [g.afterIndex, g])),
		[gaps],
	);
	const summary = useMemo(() => summarizeDates(columns), [columns]);
	const totalSkipped = gaps.reduce((n, g) => n + g.skipped, 0);
	const tableLabel =
		"Group availability. Darker green means more people are free." +
		(gaps.length > 0
			? ` Dates are non-contiguous; gaps marked ${totalSkipped} days skipped.`
			: "");
	const rowCount = useMemo(
		() => columns.reduce((n, c) => Math.max(n, c.cells.length), 0),
		[columns],
	);
	const hoveredDisplay =
		hovered && eventTimezone && viewTimezone
			? formatViewerSlot(hovered, eventTimezone, viewTimezone)
			: hovered;

	return (
		<div className="flex flex-col gap-3 lg:flex-row">
			<output aria-live="polite" className="sr-only">
				{summary}
			</output>
			<div className="overflow-x-auto pb-2">
				<table
					aria-label={tableLabel}
					className="w-full border-collapse select-none"
				>
					<thead>
						<tr>
							<th className="w-16" scope="col">
								<span className="sr-only">Time</span>
							</th>
							{columns.map((col, i) => (
								<Fragment key={col.date}>
									{i > 0 && gapByAfter.get(i - 1) ? (
										<th
											className="min-w-4 px-0.5 pb-1"
											key={`gap-${gapByAfter.get(i - 1)?.afterDate}-${gapByAfter.get(i - 1)?.beforeDate}`}
											scope="col"
										>
											<span
												aria-hidden="true"
												className="inline-block rounded border border-dashed border-muted-foreground/60 bg-muted px-1 text-[10px] text-muted-foreground"
											>
												+{gapByAfter.get(i - 1)?.skipped}
											</span>
											<span className="sr-only">
												Skipped {gapByAfter.get(i - 1)?.skipped} days between{" "}
												{gapByAfter.get(i - 1)?.afterDate} and{" "}
												{gapByAfter.get(i - 1)?.beforeDate}
											</span>
										</th>
									) : null}
									<th className="min-w-9 px-0.5 pb-1" scope="col">
										<div className="text-xs font-semibold">{col.header}</div>
										<div className="text-[10px] font-normal text-muted-foreground">
											{col.subheader}
										</div>
										{col.viewerNote !== "" && (
											<div className="text-[10px] font-normal text-muted-foreground">
												{col.viewerNote}
											</div>
										)}
									</th>
								</Fragment>
							))}
						</tr>
					</thead>
					<tbody>
						{Array.from({ length: rowCount }, (_, r) => {
							const gutter =
								columns.map((c) => c.cells[r]).find(Boolean) ?? null;
							return (
								// biome-ignore lint/suspicious/noArrayIndexKey: rows are positional by event time and never reorder
								<tr key={`row-${r}`}>
									<th
										className="pr-1 text-right align-top text-[10px] leading-5 font-normal text-muted-foreground"
										scope="row"
									>
										{gutter?.hourStart ? gutter.label : ""}
									</th>
									{columns.map((col, i) => {
										const gap = i > 0 ? gapByAfter.get(i - 1) : undefined;
										const cell = col.cells[r];
										return (
											<Fragment key={col.date}>
												{gap ? (
													<td
														aria-hidden="true"
														className="border-r border-dashed border-muted-foreground/40 bg-muted/40 p-0"
													>
														<span className="block h-5 w-4" />
													</td>
												) : null}
												{cell ? (
													<td className="p-0" key={cell.id}>
														<button
															aria-label={`${col.header} ${cell.label}: ${counts.get(cell.id)?.count ?? 0} of ${total} available`}
															className={cn(
																"block h-5 w-full cursor-default border-r border-b border-l first:border-t",
																(counts.get(cell.id)?.count ?? 0) === 0
																	? "border-rose-200 bg-rose-50"
																	: "border-emerald-800",
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
													</td>
												) : (
													<td className="p-0">
														<span className="block h-5 w-full" />
													</td>
												)}
											</Fragment>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			<div className="min-h-24 w-full shrink-0 rounded-md border p-3 text-sm lg:w-64">
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
