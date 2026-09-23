import { Fragment, useMemo, useRef, useState } from "react";
import { type PaintMode, useDragPaint } from "#/hooks/use-drag-paint";
import { useLocalStorage } from "#/hooks/use-local-storage";
import { paintTargetFromPoint } from "#/lib/paint-target";
import { cn } from "#/lib/utils";
import {
	type GridColumn,
	getDayGaps,
	gridRectangleIds,
	summarizeDates,
} from "./grid-model";

interface AvailabilityGridProps {
	columns: GridColumn[];
	selected: Set<string>;
	onCommit: (next: Set<string>) => void;
	disabled?: boolean;
}

const MODES: { label: string; value: PaintMode }[] = [
	{ label: "Auto", value: "auto" },
	{ label: "Available", value: "add" },
	{ label: "Unavailable", value: "remove" },
];

export function AvailabilityGrid({
	columns,
	disabled,
	onCommit,
	selected,
}: AvailabilityGridProps) {
	const [modeRaw, setMode] = useLocalStorage("dd:paint-mode", "auto");
	const mode: PaintMode =
		modeRaw === "add" || modeRaw === "remove" ? modeRaw : "auto";
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
	const drag = useDragPaint({ mode, onCommit, range, selected, values });

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
	const gaps = useMemo(() => getDayGaps(columns), [columns]);
	const gapByAfter = useMemo(
		() => new Map(gaps.map((g) => [g.afterIndex, g])),
		[gaps],
	);
	const summary = useMemo(() => summarizeDates(columns), [columns]);
	const totalSkipped = gaps.reduce((n, g) => n + g.skipped, 0);
	const tableLabel =
		"Your availability. Click or drag to paint times you are free. Use arrow keys to move, space to toggle." +
		(gaps.length > 0
			? ` Dates are non-contiguous; gaps marked ${totalSkipped} days skipped.`
			: "");
	const rowCount = useMemo(
		() => columns.reduce((n, c) => Math.max(n, c.cells.length), 0),
		[columns],
	);

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
		if (suppressClick.current) {
			suppressClick.current = false;
			return;
		}
		if (detail !== 0) return;
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
			<fieldset className="mb-2 flex gap-1">
				<legend className="sr-only">Paint mode</legend>
				{MODES.map((m) => (
					<button
						aria-pressed={mode === m.value}
						className={cn(
							"rounded-md border px-2 py-1 text-xs font-medium",
							mode === m.value
								? "border-emerald-700 bg-emerald-100 text-emerald-900"
								: "border-input text-muted-foreground",
						)}
						key={m.value}
						onClick={() => setMode(m.value)}
						type="button"
					>
						{m.label}
					</button>
				))}
			</fieldset>
			<output aria-live="polite" className="sr-only">
				{summary}
			</output>
			<div className={cn("overflow-x-auto pb-2", disabled && "opacity-60")}>
				<table
					aria-label={tableLabel}
					className="w-full border-collapse touch-none select-none"
					onKeyDown={onGridKeyDown}
					onPointerCancel={drag.onPointerCancel}
					onPointerMove={(e) => moveToPoint(e.clientX, e.clientY)}
					onPointerUp={(e) => finishAtPoint(e.clientX, e.clientY)}
					ref={ref}
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
															aria-label={`${col.header} ${cell.label}`}
															aria-pressed={drag.preview.has(cell.id)}
															className={cn(
																"block h-5 w-full border-r border-b border-l first:border-t",
																drag.preview.has(cell.id)
																	? "border-emerald-700 bg-emerald-400"
																	: "border-rose-200 bg-rose-100 hover:bg-rose-200",
																cell.hourStart && "border-t border-t-rose-300",
																disabled && "pointer-events-none",
															)}
															data-cell={cell.id}
															disabled={disabled}
															onClick={(e) => toggleCell(cell.id, e.detail)}
															onFocus={() => setFocusId(cell.id)}
															onPointerDown={(e) => {
																if (disabled) return;
																if (e.button !== 0 && e.pointerType === "mouse")
																	return;
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
		</div>
	);
}
