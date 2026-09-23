import { suppressToggleKey, usePaintSurface } from "#/hooks/use-paint-surface";
import { cn } from "#/lib/utils";
import { headerForWeekday } from "./grid-model";

interface WeekdayPickerProps {
	selected: Set<number>;
	onCommit: (next: Set<number>) => void;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function parseWeekday(raw: string): number | undefined {
	const n = Number(raw);
	return Number.isInteger(n) && n >= 0 && n <= 6 ? n : undefined;
}

export function WeekdayPicker({ onCommit, selected }: WeekdayPickerProps) {
	const surface = usePaintSurface<number, HTMLFieldSetElement>({
		attr: "data-weekday",
		onCommit,
		parse: parseWeekday,
		selected,
		values: WEEKDAYS,
	});

	const onFieldKeyDown = (e: React.KeyboardEvent) => {
		surface.onKeyDown(e);
		suppressToggleKey(e);
	};

	return (
		<fieldset
			className={cn("flex flex-wrap gap-1 touch-none select-none")}
			onKeyDown={onFieldKeyDown}
			onPointerCancel={surface.onPointerCancel}
			onPointerMove={surface.onPointerMove}
			onPointerUp={surface.onPointerUp}
			ref={surface.containerRef}
		>
			<legend className="sr-only">Weekdays</legend>
			{WEEKDAYS.map((day) => {
				const on = surface.preview.has(day);
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
						onClick={(e) => surface.toggle(day, e.detail)}
						onPointerDown={(e) => {
							if (e.button !== 0 && e.pointerType === "mouse") return;
							surface.start(day, e);
						}}
						onPointerEnter={() => surface.hover(day)}
						type="button"
					>
						{headerForWeekday(day)}
					</button>
				);
			})}
		</fieldset>
	);
}
