import { cn } from "cn";
import { Fragment, type ReactNode, type Ref, useId, useMemo } from "react";
import {
	type GridCell,
	type GridColumn,
	getDayGaps,
	summarizeDates,
} from "./grid-model";

interface TimeGridCellContext {
	column: GridColumn;
	columnIndex: number;
	rowIndex: number;
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

type DayGap = ReturnType<typeof getDayGaps>[number];

function GapCell({
	gap,
	variant,
}: {
	gap: DayGap;
	variant: "header" | "body";
}) {
	if (variant === "header") {
		return (
			<th className="w-3 min-w-3 px-0.5 pb-1 sm:w-4 sm:min-w-4" scope="col">
				<span
					aria-hidden="true"
					className="inline-block rounded border border-dashed border-muted-foreground bg-muted px-1 text-[10px] text-foreground"
				>
					+{gap.skipped}
				</span>
				<span className="sr-only">
					Skipped {gap.skipped} days between {gap.afterDate} and{" "}
					{gap.beforeDate}
				</span>
			</th>
		);
	}
	return (
		<td
			aria-hidden="true"
			className="border-r border-dashed border-muted-foreground bg-muted/40 p-0"
		>
			<span className="block h-12 w-3 sm:h-6 sm:w-4" />
		</td>
	);
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
	const gaps = useMemo(() => getDayGaps(columns), [columns]);
	const gapByAfter = useMemo(
		() => new Map(gaps.map((g) => [g.afterIndex, g])),
		[gaps],
	);
	const summary = useMemo(() => summarizeDates(columns), [columns]);
	const totalSkipped = gaps.reduce((n, g) => n + g.skipped, 0);
	const rawId = useId();
	const baseId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
	const captionId = `${baseId}-caption`;
	const fullLabel =
		gaps.length > 0
			? `${tableLabel} Dates are non-contiguous; gaps marked ${totalSkipped} days skipped.`
			: tableLabel;
	const rowCount = columns.reduce((n, c) => Math.max(n, c.cells.length), 0);
	const minTableWidth = 48 + columns.length * 48 + gaps.length * 12;

	return (
		<>
			{announce ? (
				<output aria-live="polite" className="sr-only">
					{summary}
				</output>
			) : null}
			<table
				aria-labelledby={captionId}
				className={cn(
					"w-full table-fixed border-collapse select-none",
					tableClassName,
				)}
				style={{ minWidth: `max(100%, ${minTableWidth}px)` }}
				onKeyDown={onKeyDown}
				onPointerCancel={onPointerCancel}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				ref={tableRef}
			>
				<caption className="sr-only" id={captionId}>
					{fullLabel}
				</caption>
				<thead>
					<tr>
						<th className="w-12 sm:w-16" scope="col">
							<span className="sr-only">Time</span>
						</th>
						{columns.map((col, i) => {
							const headerGap = i > 0 ? gapByAfter.get(i - 1) : undefined;
							return (
								<Fragment key={col.key}>
									{headerGap ? (
										<GapCell gap={headerGap} variant="header" />
									) : null}
									<th
										className="min-w-12 px-0.5 pb-1"
										id={`${baseId}-col-${i}`}
										scope="col"
									>
										<span className="sr-only">Available times for </span>
										<div className="text-xs font-semibold sm:text-[11px]">
											{col.header}
										</div>
									</th>
								</Fragment>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{Array.from({ length: rowCount }, (_, r) => {
						const gutter = columns.map((c) => c.cells[r]).find(Boolean) ?? null;
						const rowId =
							gutter?.hourStart === true ? `${baseId}-row-${r}` : null;
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: grid rows are positional and never reorder
							<tr key={`row-${r}`}>
								{gutter?.hourStart === true && gutter ? (
									<th
										className="h-12 pr-1 text-right align-top text-xs sm:text-[10px] leading-6 font-normal text-muted-foreground sm:h-auto"
										id={rowId ?? undefined}
										scope="row"
									>
										{gutter.label}
									</th>
								) : (
									<td aria-hidden="true" className="p-0">
										<span className="block h-12 w-12 sm:h-6 sm:w-16" />
									</td>
								)}
								{columns.map((col, i) => {
									const gap = i > 0 ? gapByAfter.get(i - 1) : undefined;
									const cell = col.cells[r];
									const colId = `${baseId}-col-${i}`;
									const headers = [colId, rowId]
										.filter((v): v is string => v !== null)
										.join(" ");
									return (
										<Fragment key={col.key}>
											{gap ? <GapCell gap={gap} variant="body" /> : null}
											{cell ? (
												<td
													className="relative min-w-12 p-0"
													headers={headers}
													key={cell.id}
												>
													{renderCell(cell, {
														column: col,
														columnIndex: i,
														rowIndex: r,
													})}
												</td>
											) : (
												<td className="min-w-12 p-0">
													<span className="block h-12 w-full sm:h-6" />
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
