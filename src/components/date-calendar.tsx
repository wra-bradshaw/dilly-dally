import { useState } from "react";
import { identityParse, usePaintSurface } from "#/hooks/use-paint-surface";
import { cn } from "#/lib/utils";
import { formatMarkerDate } from "./grid-model";

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

export function filterCalendarCommit(
	next: Set<string>,
	selected: Set<string>,
	visible: (string | null)[],
	minDate: string,
	maxDate: string,
): Set<string> {
	const inRange = (d: string) => d >= minDate && d <= maxDate;
	const kept = new Set<string>();
	for (const d of next) if (inRange(d)) kept.add(d);
	for (const d of selected) {
		if (!visible.includes(d) && inRange(d)) kept.add(d);
	}
	return kept;
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
	const [ym, setYm] = useState(() => {
		const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(minDate);
		if (match) {
			const y = Number(match[1]);
			const m = Number(match[2]);
			if (Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12) {
				return { m: m - 1, y };
			}
		}
		const now = new Date();
		return { m: now.getUTCMonth(), y: now.getUTCFullYear() };
	});
	const matrix = buildMonthMatrix(ym.y, ym.m);

	const enabled = (day: string | null): day is string =>
		day !== null && day >= minDate && day <= maxDate;

	const commitEnabled = (next: Set<string>) => {
		onCommit(
			filterCalendarCommit(next, selected, matrix.flat(), minDate, maxDate),
		);
	};

	const surface = usePaintSurface<string, HTMLDivElement>({
		attr: "data-day",
		onCommit: commitEnabled,
		parse: identityParse,
		selected,
		values: matrix.flat().filter((d): d is string => d !== null),
	});

	const monthLabel = new Intl.DateTimeFormat(undefined, {
		month: "long",
		timeZone: "UTC",
		year: "numeric",
	}).format(new Date(Date.UTC(ym.y, ym.m, 1)));
	const canPrev =
		`${ym.y}-${String(ym.m + 1).padStart(2, "0")}-01` > minDate.slice(0, 7);
	const lastDay = matrix.flat().filter(Boolean).at(-1) ?? "";
	const canNext = lastDay < maxDate;

	const shift = (dir: number) => {
		const d = new Date(Date.UTC(ym.y, ym.m + dir, 1));
		setYm({ m: d.getUTCMonth(), y: d.getUTCFullYear() });
	};

	let blanks = 0;

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
			{/* biome-ignore lint/a11y/noStaticElementInteractions: Escape cancels drag-paint; cells stay native buttons */}
			<div
				className={cn(
					"grid grid-cols-7 gap-1 select-none",
					surface.painting && "touch-none",
				)}
				onKeyDown={surface.onKeyDown}
				onPointerCancel={surface.onPointerCancel}
				onPointerMove={surface.onPointerMove}
				onPointerUp={surface.onPointerUp}
				ref={surface.containerRef}
			>
				{[
					{ full: "Sunday", short: "S" },
					{ full: "Monday", short: "M" },
					{ full: "Tuesday", short: "T" },
					{ full: "Wednesday", short: "W" },
					{ full: "Thursday", short: "T" },
					{ full: "Friday", short: "F" },
					{ full: "Saturday", short: "S" },
				].map((d) => (
					<div
						className="pb-1 text-center text-xs text-muted-foreground"
						key={d.full}
						title={d.full}
					>
						<span aria-hidden="true">{d.short}</span>
						<span className="sr-only">{d.full}</span>
					</div>
				))}
				{matrix.flat().map((day) => {
					if (day === null) {
						blanks += 1;
						return <div key={`blank-${ym.y}-${ym.m}-${blanks}`} />;
					}
					const off = !enabled(day);
					const on = surface.preview.has(day);
					const dayNum = /^\d{4}-\d{2}-(\d{2})$/.exec(day);
					return (
						<button
							aria-hidden={off || undefined}
							aria-label={formatMarkerDate(day)}
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
							data-day={day}
							key={day}
							onClick={(e) => surface.toggle(day, e.detail)}
							onPointerDown={(e) => {
								if (off) return;
								if (e.button !== 0 && e.pointerType === "mouse") return;
								surface.start(day, e);
							}}
							onPointerEnter={() => {
								if (off) return;
								surface.hover(day);
							}}
							type="button"
						>
							{dayNum ? Number(dayNum[1]) : ""}
						</button>
					);
				})}
			</div>
		</div>
	);
}
