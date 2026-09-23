import { useId, useMemo, useRef } from "react";
import { useGridKeyboardNav } from "#/hooks/use-grid-keyboard-nav";
import {
	identityParse,
	suppressToggleKey,
	usePaintSurface,
} from "#/hooks/use-paint-surface";
import { cn } from "#/lib/utils";
import {
	buildGridPos,
	type GridColumn,
	gridRectangleIdsFromPos,
} from "./grid-model";
import { TimeGrid } from "./time-grid";

interface AvailabilityGridProps {
	columns: GridColumn[];
	selected: Set<string>;
	onCommit: (next: Set<string>) => void;
	disabled?: boolean;
	disabledReasonId?: string;
	announce?: boolean;
}

export function AvailabilityGrid({
	announce = true,
	columns,
	disabled,
	disabledReasonId,
	onCommit,
	selected,
}: AvailabilityGridProps) {
	const tableRef = useRef<HTMLTableElement>(null);
	const hintId = useId();
	const pos = useMemo(() => buildGridPos(columns), [columns]);
	const { onGridKeyDown, roving, setFocusId, values } = useGridKeyboardNav(
		columns,
		pos,
		tableRef,
	);
	const range = useMemo(
		() => (_values: string[], from: string, to: string) =>
			gridRectangleIdsFromPos(columns, pos, from, to),
		[columns, pos],
	);
	const surface = usePaintSurface<string, HTMLTableElement>({
		attr: "data-cell",
		containerRef: tableRef,
		disabled,
		onCommit,
		parse: identityParse,
		range,
		selected,
		values,
	});

	const onCellKeyDown = (e: React.KeyboardEvent) => {
		surface.onKeyDown(e);
		onGridKeyDown(e);
		if (e.key === " " || e.key === "Enter") {
			if (suppressToggleKey(e)) return;
			const id = (e.target as HTMLElement | null)?.dataset?.cell;
			if (id && !disabled) {
				e.preventDefault();
				surface.toggle(id, 0);
			}
		}
	};

	return (
		<div>
			<div
				className={cn(
					"touch-pan-x touch-pan-y overflow-x-auto pb-2",
					disabled && "opacity-60",
				)}
			>
				<span className="sr-only" id={hintId}>
					Selected times show a checkmark as well as color.
					{disabled ? " Grid is temporarily unavailable." : ""}
				</span>
				<TimeGrid
					announce={announce}
					columns={columns}
					onKeyDown={onCellKeyDown}
					onPointerCancel={surface.onPointerCancel}
					onPointerMove={surface.onPointerMove}
					onPointerUp={surface.onPointerUp}
					renderCell={(cell, ctx) => {
						const isSelected = surface.preview.has(cell.id);
						return (
							<button
								aria-describedby={[hintId, disabledReasonId]
									.filter(Boolean)
									.join(" ")}
								aria-disabled={disabled}
								aria-label={`${ctx.segment.label} ${cell.label}`}
								aria-pressed={isSelected}
								className={cn(
									"relative block h-6 min-h-6 w-full border-r border-b border-l transition-colors motion-reduce:transition-none first:border-t hover:ring-2 hover:ring-inset hover:ring-ring focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring forced-colors:focus-visible:outline-[Highlight]",
									isSelected
										? "border-emerald-800 bg-emerald-400 dark:border-emerald-300 dark:bg-emerald-700"
										: "border-rose-600 bg-rose-100 hover:bg-rose-200 dark:border-rose-400 dark:bg-rose-950/40 dark:hover:bg-rose-900/60",
									cell.hourStart &&
										"border-t border-t-rose-600 dark:border-t-rose-400",
									ctx.afterBreak && "border-t-2 border-t-foreground/50",
								)}
								data-cell={cell.id}
								onClick={(e) => surface.toggle(cell.id, e.detail)}
								onFocus={() => setFocusId(cell.id)}
								onPointerDown={(e) => {
									if (disabled) return;
									if (e.button !== 0 && e.pointerType === "mouse") return;
									surface.start(cell.id, e);
								}}
								onPointerEnter={() => {
									if (disabled) return;
									surface.hover(cell.id);
								}}
								tabIndex={cell.id === roving ? 0 : -1}
								type="button"
							>
								<span
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] leading-none font-bold",
										isSelected
											? "text-emerald-950 dark:text-emerald-100"
											: "text-transparent",
									)}
								>
									{isSelected ? "✓" : ""}
								</span>
							</button>
						);
					}}
					tableClassName="touch-none"
					tableLabel="Your availability. Click or drag to paint times you are free. Use arrow keys to move, space to toggle."
					tableRef={surface.containerRef}
				/>
			</div>
		</div>
	);
}
