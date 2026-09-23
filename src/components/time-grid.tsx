import { Fragment, type ReactNode, type Ref, useMemo } from "react";
import { cn } from "#/lib/utils";
import {
	buildTimeRows,
	type DateMarker,
	type GridCell,
	type GridColumn,
	getDateBreaks,
	getDayGaps,
	segmentForCell,
	summarizeDates,
} from "./grid-model";

interface TimeGridCellContext {
	column: GridColumn;
	columnIndex: number;
	rowIndex: number;
	segment: DateMarker;
	afterBreak: boolean;
}

interface TimeGridProps {
	columns: GridColumn[];
	tableLabel: string;
	renderCell: (cell: GridCell, ctx: TimeGridCellContext) => ReactNode;
	tableRef?: Ref<HTMLTableElement>;
	tableClassName?: string;
	announce?: boolean;
	onKeyDown?: (e: React.KeyboardEvent) => void;
	onPointerCancel?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

function useTimeGrid(columns: GridColumn[]) {
	const gaps = useMemo(() => getDayGaps(columns), [columns]);
	const gapByAfter = useMemo(
		() => new Map(gaps.map((g) => [g.afterIndex, g])),
		[gaps],
	);
	const breaksByCol = useMemo(
		() => columns.map((c) => getDateBreaks(c)),
		[columns],
	);
	const rows = useMemo(() => buildTimeRows(columns), [columns]);
	const summary = useMemo(() => summarizeDates(columns), [columns]);
	const totalSkipped = gaps.reduce((n, g) => n + g.skipped, 0);
	return { breaksByCol, gapByAfter, gaps, rows, summary, totalSkipped };
}

export function TimeGrid({
	announce = true,
	columns,
	onKeyDown,
	onPointerCancel,
	onPointerMove,
	onPointerUp,
	renderCell,
	tableClassName,
	tableLabel,
	tableRef,
}: TimeGridProps) {
	const { breaksByCol, gapByAfter, gaps, rows, summary, totalSkipped } =
		useTimeGrid(columns);
	const fullLabel =
		gaps.length > 0
			? `${tableLabel} Dates are non-contiguous; gaps marked ${totalSkipped} days skipped.`
			: tableLabel;

	return (
		<>
			{announce ? (
				<output aria-live="polite" className="sr-only">
					{summary}
				</output>
			) : null}
			<table
				aria-label={fullLabel}
				className={cn("w-full border-collapse select-none", tableClassName)}
				onKeyDown={onKeyDown}
				onPointerCancel={onPointerCancel}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				ref={tableRef}
			>
				<thead>
					<tr>
						<th className="w-16" scope="col">
							<span className="sr-only">Time</span>
						</th>
						{columns.map((col, i) => (
							<Fragment key={col.key}>
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
								<th className="min-w-9 px-0.5" scope="col" />
							</Fragment>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, ri) => {
						if (row.kind === "markers") {
							return (
								// biome-ignore lint/suspicious/noArrayIndexKey: interleaved marker/cell rows are positional and never reorder
								<tr key={`marker-${ri}`}>
									<td className="p-0" aria-hidden="true">
										<span className="block h-1 w-16" />
									</td>
									{columns.map((col, i) => {
										const gap = i > 0 ? gapByAfter.get(i - 1) : undefined;
										const marker = row.markers[i] ?? null;
										return (
											<Fragment key={col.key}>
												{gap ? (
													<td
														aria-hidden="true"
														className="border-r border-dashed border-muted-foreground/40 bg-muted/40 p-0"
													>
														<span className="block h-7 w-4" />
													</td>
												) : null}
												{marker ? (
													<th
														className={cn(
															"px-0.5 pb-1",
															marker.rowIndex === 0 ? "pt-1" : "pt-4",
														)}
														scope="col"
													>
														<div className="text-xs font-semibold">
															{marker.label}
														</div>
													</th>
												) : (
													<td aria-hidden="true" className="p-0">
														<span className="block h-7 w-full" />
													</td>
												)}
											</Fragment>
										);
									})}
								</tr>
							);
						}
						const r = row.rowIndex;
						const gutter = columns.map((c) => c.cells[r]).find(Boolean) ?? null;
						return (
							<tr key={`row-${r}`}>
								<th
									className="pr-1 text-right align-top text-[10px] leading-6 font-normal text-muted-foreground"
									scope="row"
								>
									{gutter?.hourStart ? gutter.label : ""}
								</th>
								{columns.map((col, i) => {
									const gap = i > 0 ? gapByAfter.get(i - 1) : undefined;
									const cell = col.cells[r];
									const breaks = breaksByCol[i] ?? [];
									const segment = cell ? segmentForCell(breaks, r) : null;
									const afterBreak =
										segment !== null && segment.rowIndex === r && r !== 0;
									return (
										<Fragment key={col.key}>
											{gap ? (
												<td
													aria-hidden="true"
													className="border-r border-dashed border-muted-foreground/40 bg-muted/40 p-0"
												>
													<span className="block h-6 w-4" />
												</td>
											) : null}
											{cell && segment ? (
												<td className="p-0" key={cell.id}>
													{renderCell(cell, {
														afterBreak,
														column: col,
														columnIndex: i,
														rowIndex: r,
														segment,
													})}
												</td>
											) : (
												<td className="p-0">
													<span className="block h-6 w-full" />
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
		</>
	);
}
