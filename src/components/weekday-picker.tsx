import { useRef } from "react";
import { useDragPaint } from "#/hooks/use-drag-paint";
import { paintTargetFromPoint } from "#/lib/paint-target";
import { cn } from "#/lib/utils";
import { headerForWeekday } from "./grid-model";

interface WeekdayPickerProps {
	selected: Set<number>;
	onCommit: (next: Set<number>) => void;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function WeekdayPicker({ onCommit, selected }: WeekdayPickerProps) {
	const ref = useRef<HTMLFieldSetElement>(null);
	const suppressClick = useRef(false);
	const clearTimer = useRef<number | undefined>(undefined);
	const drag = useDragPaint({
		onCommit,
		selected,
		values: WEEKDAYS,
	});

	const capture = (e: React.PointerEvent) => {
		try {
			ref.current?.setPointerCapture?.(e.pointerId);
		} catch {}
	};

	const toggleWeekday = (day: number, detail: number) => {
		if (detail !== 0) {
			if (suppressClick.current) suppressClick.current = false;
			return;
		}
		const next = new Set(selected);
		if (next.has(day)) next.delete(day);
		else next.add(day);
		onCommit(next);
	};

	const moveToPoint = (clientX: number, clientY: number) => {
		if (!drag.painting) return;
		const day = paintTargetFromPoint(clientX, clientY, "data-weekday");
		if (day === null) return;
		const n = Number(day);
		if (Number.isInteger(n) && n >= 0 && n <= 6) drag.onPointerEnter(n);
	};

	const finishAtPoint = (clientX: number, clientY: number) => {
		const day = paintTargetFromPoint(clientX, clientY, "data-weekday");
		const n = day === null ? NaN : Number(day);
		const target =
			Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6
				? (n as number)
				: undefined;
		if (target !== undefined) {
			suppressClick.current = true;
			if (clearTimer.current !== undefined)
				window.clearTimeout(clearTimer.current);
			clearTimer.current = window.setTimeout(() => {
				suppressClick.current = false;
				clearTimer.current = undefined;
			}, 300);
		}
		drag.onPointerUp(target);
	};

	return (
		<fieldset
			className={cn(
				"flex flex-wrap gap-1 select-none",
				drag.painting && "touch-none",
			)}
			onPointerCancel={drag.onPointerCancel}
			onPointerMove={(e) => moveToPoint(e.clientX, e.clientY)}
			onPointerUp={(e) => finishAtPoint(e.clientX, e.clientY)}
			ref={ref}
		>
			<legend className="sr-only">Weekdays</legend>
			{WEEKDAYS.map((day) => {
				const on = drag.preview.has(day);
				return (
					<button
						aria-pressed={on}
						className={cn(
							"rounded-md border px-2 py-1 text-xs font-medium",
							on
								? "border-emerald-700 bg-emerald-100 text-emerald-900"
								: "border-input text-muted-foreground",
						)}
						data-weekday={day}
						key={day}
						onClick={(e) => toggleWeekday(day, e.detail)}
						onPointerDown={(e) => {
							if (e.button !== 0 && e.pointerType === "mouse") return;
							if (clearTimer.current !== undefined) {
								window.clearTimeout(clearTimer.current);
								clearTimer.current = undefined;
							}
							suppressClick.current = false;
							capture(e);
							drag.onPointerDown(day);
						}}
						onPointerEnter={() => drag.onPointerEnter(day)}
						type="button"
					>
						{headerForWeekday(day)}
					</button>
				);
			})}
		</fieldset>
	);
}
