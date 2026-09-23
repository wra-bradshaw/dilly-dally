import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { suppressToggleKey, usePaintSurface } from "#/hooks/use-paint-surface";
import { headerForWeekday, weekdayFullName } from "./grid-model";

interface WeekdayPickerProps {
	selected: Set<number>;
	onCommit: (next: Set<number>) => void;
	labelledBy?: string;
	describedBy?: string;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function parseWeekday(raw: string): number | undefined {
	const n = Number(raw);
	return Number.isInteger(n) && n >= 0 && n <= 6 ? n : undefined;
}

export function WeekdayPicker({
	describedBy,
	labelledBy,
	onCommit,
	selected,
}: WeekdayPickerProps) {
	const surface = usePaintSurface<number, HTMLDivElement>({
		attr: "data-weekday",
		onCommit,
		parse: parseWeekday,
		selected,
		values: WEEKDAYS,
	});

	const onGroupKeyDown = (e: React.KeyboardEvent) => {
		surface.onKeyDown(e);
		suppressToggleKey(e);
	};

	return (
		<ToggleGroup
			aria-describedby={describedBy}
			aria-label={labelledBy ? undefined : "Weekdays"}
			aria-labelledby={labelledBy}
			className="flex-wrap touch-none select-none"
			onKeyDown={onGroupKeyDown}
			onPointerCancel={surface.onPointerCancel}
			onPointerMove={surface.onPointerMove}
			onPointerUp={surface.onPointerUp}
			ref={surface.containerRef}
			size="sm"
			spacing={1}
			type="multiple"
			value={[...surface.preview].map(String)}
			variant="outline"
		>
			{WEEKDAYS.map((day) => {
				const full = weekdayFullName(day);
				return (
					<ToggleGroupItem
						aria-label={full}
						className="text-muted-foreground data-[state=on]:border-emerald-700 data-[state=on]:bg-emerald-400 data-[state=on]:font-semibold data-[state=on]:text-emerald-950 dark:data-[state=on]:border-emerald-500 dark:data-[state=on]:bg-emerald-700 dark:data-[state=on]:text-emerald-50 aria-pressed:border-emerald-700 aria-pressed:bg-emerald-400 aria-pressed:font-semibold aria-pressed:text-emerald-950 dark:aria-pressed:border-emerald-500 dark:aria-pressed:bg-emerald-700 dark:aria-pressed:text-emerald-50"
						data-weekday={day}
						key={day}
						onClick={(e) => surface.toggle(day, e.detail)}
						onPointerDown={(e) => {
							if (e.button !== 0 && e.pointerType === "mouse") return;
							surface.start(day, e);
						}}
						onPointerEnter={() => surface.hover(day)}
						title={full}
						value={String(day)}
					>
						{headerForWeekday(day)}
					</ToggleGroupItem>
				);
			})}
		</ToggleGroup>
	);
}
