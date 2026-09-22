import { useMemo, useRef, useState } from "react";
import { type PaintMode, useDragPaint } from "#/hooks/use-drag-paint";
import { useLocalStorage } from "#/hooks/use-local-storage";
import { cn } from "#/lib/utils";
import type { GridColumn } from "./grid-model";

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
	const moved = useRef(false);
	const values = useMemo(
		() => columns.flatMap((c) => c.cells.map((cell) => cell.id)),
		[columns],
	);
	const drag = useDragPaint({ mode, onCommit, selected, values });

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
	const rowCount = columns[0]?.cells.length ?? 0;

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

	const toggleCell = (id: string) => {
		if (moved.current) {
			moved.current = false;
			return;
		}
		drag.onPointerUp();
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onCommit(next);
	};

	const capture = (e: React.PointerEvent) => {
		try {
			(ref.current as unknown as HTMLElement)?.setPointerCapture?.(e.pointerId);
		} catch {
			/* pointer capture unavailable */
		}
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
			<div className={cn("overflow-x-auto pb-2", disabled && "opacity-60")}>
				<table
					aria-label="Your availability. Click or drag to paint times you are free. Use arrow keys to move, space to toggle."
					className="w-full border-collapse touch-none select-none"
					onKeyDown={onGridKeyDown}
					onPointerUp={drag.onPointerUp}
					ref={ref}
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
									const on = drag.preview.has(cell.id);
									return (
										<td className="p-0" key={cell.id}>
											<button
												aria-label={`${col.header} ${cell.label}`}
												aria-pressed={on}
												className={cn(
													"block h-5 w-full border-r border-b border-l first:border-t",
													on
														? "border-emerald-700 bg-emerald-400"
														: "border-rose-200 bg-rose-100 hover:bg-rose-200",
													cell.hourStart && "border-t border-t-rose-300",
													disabled && "pointer-events-none",
												)}
												data-cell={cell.id}
												disabled={disabled}
												onClick={() => toggleCell(cell.id)}
												onFocus={() => setFocusId(cell.id)}
												onPointerDown={(e) => {
													if (disabled) return;
													moved.current = false;
													capture(e);
													drag.onPointerDown(cell.id);
												}}
												onPointerEnter={() => {
													if (disabled) return;
													if (drag.painting) moved.current = true;
													drag.onPointerEnter(cell.id);
												}}
												tabIndex={cell.id === roving ? 0 : -1}
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
		</div>
	);
}
