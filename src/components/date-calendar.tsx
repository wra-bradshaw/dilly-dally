import { useRef, useState } from "react";
import { useDragPaint } from "#/hooks/use-drag-paint";
import { cn } from "#/lib/utils";

export function buildMonthMatrix(
	year: number,
	month: number,
): (string | null)[][] {
	const pad = (n: number) => String(n).padStart(2, "0");
	const startDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
	const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const cells: (string | null)[] = Array.from({ length: startDay }, () => null);
	for (let d = 1; d <= daysInMonth; d++) {
		cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);
	}
	while (cells.length % 7 !== 0) cells.push(null);
	const weeks: (string | null)[][] = [];
	for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
	return weeks;
}

interface DateCalendarProps {
	selected: Set<string>;
	onCommit: (next: Set<string>) => void;
	minDate: string;
	maxDate: string;
}

export function DateCalendar({
	maxDate,
	minDate,
	onCommit,
	selected,
}: DateCalendarProps) {
	const [ym, setYm] = useState(() => ({
		m: Number(minDate.slice(5, 7)) - 1,
		y: Number(minDate.slice(0, 4)),
	}));
	const matrix = buildMonthMatrix(ym.y, ym.m);
	const ref = useRef<HTMLDivElement>(null);
	const moved = useRef(false);

	const enabled = (day: string | null): day is string =>
		day !== null && day >= minDate && day <= maxDate;

	const drag = useDragPaint({
		mode: "auto",
		onCommit: (next) => {
			const kept = new Set<string>();
			for (const d of next) if (enabled(d)) kept.add(d);
			for (const d of selected) {
				if (!matrix.flat().includes(d) && d >= minDate && d <= maxDate)
					kept.add(d);
			}
			onCommit(kept);
		},
		selected,
		values: matrix.flat().filter((d): d is string => d !== null),
	});

	const monthLabel = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString(
		"en-US",
		{
			month: "long",
			timeZone: "UTC",
			year: "numeric",
		},
	);
	const canPrev =
		`${ym.y}-${String(ym.m + 1).padStart(2, "0")}-01` > minDate.slice(0, 7);
	const lastDay = matrix.flat().filter(Boolean).at(-1) ?? "";
	const canNext = lastDay < maxDate;

	const shift = (dir: number) => {
		const d = new Date(Date.UTC(ym.y, ym.m + dir, 1));
		setYm({ m: d.getUTCMonth(), y: d.getUTCFullYear() });
	};

	const capture = (e: React.PointerEvent) => {
		try {
			ref.current?.setPointerCapture?.(e.pointerId);
		} catch {
			/* pointer capture unavailable */
		}
	};

	let blanks = 0;

	const toggleDay = (day: string) => {
		if (moved.current) {
			moved.current = false;
			return;
		}
		const next = new Set(selected);
		if (next.has(day)) next.delete(day);
		else next.add(day);
		drag.onPointerUp();
		onCommit(next);
	};

	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<button
					aria-label="Previous month"
					className="rounded-md border px-2 py-1 text-sm disabled:opacity-40"
					disabled={!canPrev}
					onClick={() => shift(-1)}
					type="button"
				>
					‹
				</button>
				<div className="text-sm font-semibold">{monthLabel}</div>
				<button
					aria-label="Next month"
					className="rounded-md border px-2 py-1 text-sm disabled:opacity-40"
					disabled={!canNext}
					onClick={() => shift(1)}
					type="button"
				>
					›
				</button>
			</div>
			<div
				className="grid touch-none grid-cols-7 gap-1 select-none"
				onPointerUp={drag.onPointerUp}
				ref={ref}
			>
				{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
					<div
						className="pb-1 text-center text-xs text-muted-foreground"
						// biome-ignore lint/suspicious/noArrayIndexKey: static weekday headers never reorder
						key={`${d}-${i}`}
					>
						{d}
					</div>
				))}
				{matrix.flat().map((day) => {
					if (day === null) {
						blanks += 1;
						return <div key={`blank-${ym.y}-${ym.m}-${blanks}`} />;
					}
					const off = !enabled(day);
					const on = drag.preview.has(day);
					return (
						<button
							aria-pressed={on}
							className={cn(
								"flex aspect-square items-center justify-center rounded-md border text-sm",
								off && "invisible",
								!off &&
									!on &&
									"border-input bg-background hover:border-primary",
								!off &&
									on &&
									"border-emerald-700 bg-emerald-400 font-semibold text-emerald-950",
							)}
							disabled={off}
							key={day}
							onClick={() => toggleDay(day)}
							onPointerDown={(e) => {
								moved.current = false;
								capture(e);
								drag.onPointerDown(day);
							}}
							onPointerEnter={() => {
								if (drag.painting) moved.current = true;
								drag.onPointerEnter(day);
							}}
							type="button"
						>
							{Number(day.slice(8, 10))}
						</button>
					);
				})}
			</div>
		</div>
	);
}
