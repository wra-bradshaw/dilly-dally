import { useRef, useState } from "react";
import {
	identityParse,
	suppressToggleKey,
	usePaintSurface,
} from "#/hooks/use-paint-surface";
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

export function trimDisabledWeeks(
	weeks: (string | null)[][],
	minDate: string,
	maxDate: string,
): (string | null)[][] {
	return weeks.filter((week) =>
		week.some((d) => d !== null && d >= minDate && d <= maxDate),
	);
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
export interface CalendarMonth {
	y: number;
	m: number;
}

const MAX_MONTHS = 24;

const AUTOSCROLL_EDGE = 40;
const AUTOSCROLL_BASE = 1;
const AUTOSCROLL_SLOPE = 0.1;
const AUTOSCROLL_MAX = 5;

export function autoscrollVelocity(distancePx: number): number {
	if (distancePx <= 0) return 0;
	return Math.min(
		AUTOSCROLL_MAX,
		AUTOSCROLL_BASE + AUTOSCROLL_SLOPE * distancePx,
	);
}

function parseYearMonth(raw: string): CalendarMonth | null {
	const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(raw);
	if (!match) return null;
	const y = Number(match[1]);
	const m = Number(match[2]);
	if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
		return null;
	}
	return { m: m - 1, y };
}

function currentYearMonth(): CalendarMonth {
	const now = new Date();
	return { m: now.getUTCMonth(), y: now.getUTCFullYear() };
}

export function monthsInRange(
	minDate: string,
	maxDate: string,
): CalendarMonth[] {
	const start = parseYearMonth(minDate) ?? currentYearMonth();
	const end = parseYearMonth(maxDate);
	const months: CalendarMonth[] = [];
	let { m, y } = start;
	let guard = 0;
	while (
		end !== null &&
		(y < end.y || (y === end.y && m <= end.m)) &&
		guard < MAX_MONTHS
	) {
		months.push({ m, y });
		const d = new Date(Date.UTC(y, m + 1, 1));
		y = d.getUTCFullYear();
		m = d.getUTCMonth();
		guard += 1;
	}
	if (months.length === 0) months.push(start);
	return months;
}

interface DateCalendarProps {
	selected: Set<string>;
	onCommit: (next: Set<string>) => void;
	minDate: string;
	maxDate: string;
	labelledBy?: string;
	describedBy?: string;
}

export function DateCalendar({
	describedBy,
	labelledBy,
	maxDate,
	minDate,
	onCommit,
	selected,
}: DateCalendarProps) {
	const months = monthsInRange(minDate, maxDate);
	const enabled = (day: string | null): day is string =>
		day !== null && day >= minDate && day <= maxDate;
	const sections = months
		.map(({ m, y }) => ({
			key: `${y}-${m}`,
			label: new Intl.DateTimeFormat("en-US", {
				month: "long",
				timeZone: "UTC",
				year: "numeric",
			}).format(new Date(Date.UTC(y, m, 1))),
			weeks: trimDisabledWeeks(buildMonthMatrix(y, m), minDate, maxDate),
		}))
		.filter((s) => s.weeks.length > 0);

	const days = sections.flatMap((s) => s.weeks.flat());
	const firstEnabled = days.find((d) => enabled(d));
	const [focusDay, setFocusDay] = useState<string | null>(null);
	const roving =
		focusDay !== null && days.includes(focusDay) && enabled(focusDay)
			? focusDay
			: (firstEnabled ?? null);

	const commitEnabled = (next: Set<string>) => {
		onCommit(filterCalendarCommit(next, selected, days, minDate, maxDate));
	};

	const scrollRef = useRef<HTMLDivElement | null>(null);

	const surface = usePaintSurface<string, HTMLDivElement>({
		attr: "data-day",
		onCommit: commitEnabled,
		parse: identityParse,
		selected,
		values: days.filter((d): d is string => d !== null),
	});

	const autoscrollY = useRef<number | null>(null);
	const autoscrollRaf = useRef<number | null>(null);

	const stopAutoscroll = () => {
		if (autoscrollRaf.current !== null) {
			cancelAnimationFrame(autoscrollRaf.current);
			autoscrollRaf.current = null;
		}
		autoscrollY.current = null;
	};

	const autoscrollStep = () => {
		const el = scrollRef.current;
		const y = autoscrollY.current;
		if (el === null || y === null) {
			autoscrollRaf.current = null;
			autoscrollY.current = null;
			return;
		}
		const rect = el.getBoundingClientRect();
		let delta = 0;
		if (y > rect.bottom - AUTOSCROLL_EDGE) {
			delta = autoscrollVelocity(y - (rect.bottom - AUTOSCROLL_EDGE));
		} else if (y < rect.top + AUTOSCROLL_EDGE) {
			delta = -autoscrollVelocity(rect.top + AUTOSCROLL_EDGE - y);
		} else {
			autoscrollRaf.current = null;
			autoscrollY.current = null;
			return;
		}
		if (delta !== 0) {
			el.scrollTop += delta;
		}
		autoscrollRaf.current = requestAnimationFrame(autoscrollStep);
	};

	const autoscroll = (e: React.PointerEvent) => {
		const el = scrollRef.current;
		if (el === null || !surface.painting) {
			stopAutoscroll();
			return;
		}
		const rect = el.getBoundingClientRect();
		let depth = 0;
		let direction = 0;
		if (e.clientY > rect.bottom - AUTOSCROLL_EDGE) {
			depth = e.clientY - (rect.bottom - AUTOSCROLL_EDGE);
			direction = 1;
		} else if (e.clientY < rect.top + AUTOSCROLL_EDGE) {
			depth = rect.top + AUTOSCROLL_EDGE - e.clientY;
			direction = -1;
		} else {
			stopAutoscroll();
			return;
		}
		const velocity = autoscrollVelocity(depth);
		if (velocity <= 0) {
			stopAutoscroll();
			return;
		}
		el.scrollTop += direction * velocity;
		autoscrollY.current = e.clientY;
		if (autoscrollRaf.current === null) {
			autoscrollRaf.current = requestAnimationFrame(autoscrollStep);
		}
	};

	const onPointerMove = (e: React.PointerEvent) => {
		autoscroll(e);
		surface.onPointerMove(e);
	};

	const onPointerUp = (e: React.PointerEvent) => {
		stopAutoscroll();
		surface.onPointerUp(e);
	};

	const onPointerCancel = () => {
		stopAutoscroll();
		surface.onPointerCancel();
	};

	const focusDayCell = (day: string) => {
		setFocusDay(day);
		surface.containerRef.current
			?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)
			?.focus();
	};

	const onDayKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Escape") stopAutoscroll();
		surface.onKeyDown(e);
		if (e.key === " " || e.key === "Enter") {
			suppressToggleKey(e);
			return;
		}
		if (
			e.key !== "ArrowLeft" &&
			e.key !== "ArrowRight" &&
			e.key !== "ArrowUp" &&
			e.key !== "ArrowDown" &&
			e.key !== "Home" &&
			e.key !== "End"
		) {
			return;
		}
		const target = e.target as HTMLElement | null;
		const active = document.activeElement as HTMLElement | null;
		const current = target?.dataset?.day ?? active?.dataset?.day ?? roving;
		if (!current) {
			e.preventDefault();
			return;
		}
		const idx = days.indexOf(current);
		if (idx === -1) {
			e.preventDefault();
			if (firstEnabled) focusDayCell(firstEnabled);
			return;
		}
		if (e.key === "Home" || e.key === "End") {
			const rowStart = Math.floor(idx / 7) * 7;
			const week = days.slice(rowStart, rowStart + 7);
			const edge =
				e.key === "Home"
					? week.find((d) => d !== undefined && enabled(d))
					: [...week].reverse().find((d) => d !== undefined && enabled(d));
			e.preventDefault();
			if (edge) focusDayCell(edge);
			return;
		}
		const col = idx % 7;
		const step =
			e.key === "ArrowLeft"
				? -1
				: e.key === "ArrowRight"
					? 1
					: e.key === "ArrowUp"
						? -7
						: 7;
		let found: string | null = null;
		if (step === 1 || step === -1) {
			for (let i = idx + step; i >= 0 && i < days.length; i += step) {
				const d = days[i];
				if (d !== undefined && enabled(d)) {
					found = d;
					break;
				}
			}
		} else {
			for (
				let i = idx + step;
				i >= 0 && i < days.length && i % 7 === col;
				i += step
			) {
				const d = days[i];
				if (d !== undefined && enabled(d)) {
					found = d;
					break;
				}
			}
		}
		if (found) {
			e.preventDefault();
			focusDayCell(found);
			return;
		}
		e.preventDefault();
	};

	return (
		<div>
			{/* biome-ignore lint/a11y/useSemanticElements: inner group inside parent fieldset */}
			<div
				aria-describedby={describedBy}
				aria-labelledby={labelledBy}
				className={cn("touch-none select-none")}
				data-slot="date-calendar"
				onKeyDown={onDayKeyDown}
				onPointerCancel={onPointerCancel}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				ref={surface.containerRef}
				role="group"
			>
				<div
					className="max-h-[400px] overflow-y-auto overscroll-contain"
					data-slot="date-calendar-months"
					ref={scrollRef}
				>
					<div
						className="sticky top-0 z-10 grid grid-cols-7 gap-1 bg-card py-1"
						data-slot="date-calendar-weekdays"
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
								className="text-center text-xs text-muted-foreground"
								key={d.full}
							>
								<abbr
									aria-label={d.full}
									className="no-underline"
									title={d.full}
								>
									{d.short}
								</abbr>
							</div>
						))}
					</div>
					{sections.map((section) => {
						const headingId = `calendar-month-${section.key}`;
						return (
							<section
								aria-labelledby={headingId}
								className="mt-3 first:mt-1"
								key={section.key}
							>
								<h2 className="mb-1 text-sm font-semibold" id={headingId}>
									{section.label}
								</h2>
								<div className="grid grid-cols-7 gap-1">
									{section.weeks.flatMap((week) => {
										let offset = 0;
										while (offset < week.length && week[offset] === null) {
											offset += 1;
										}
										return week.slice(offset).map((day, i) => {
											if (day === null) return null;
											const off = !enabled(day);
											const gridStyle =
												i === 0 && offset > 0
													? { gridColumnStart: offset + 1 }
													: undefined;
											if (off) {
												return (
													<span
														aria-hidden="true"
														className="aspect-square"
														data-filler=""
														key={day}
														style={gridStyle}
													/>
												);
											}
											const on = surface.preview.has(day);
											const dayNum = /^\d{4}-\d{2}-(\d{2})$/.exec(day);
											return (
												<button
													aria-label={formatMarkerDate(day)}
													aria-pressed={on}
													className={cn(
														"flex aspect-square items-center justify-center rounded-none border text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
														!on &&
															"border-input bg-background hover:border-primary",
														on &&
															"border-emerald-700 bg-emerald-400 font-semibold text-emerald-950 dark:border-emerald-500 dark:bg-emerald-700 dark:text-emerald-50",
													)}
													data-day={day}
													key={day}
													onClick={(e) => surface.toggle(day, e.detail)}
													onFocus={() => setFocusDay(day)}
													style={gridStyle}
													tabIndex={day === roving ? 0 : -1}
													onPointerDown={(e) => {
														if (e.button !== 0 && e.pointerType === "mouse")
															return;
														surface.start(day, e);
													}}
													onPointerEnter={() => {
														surface.hover(day);
													}}
													type="button"
												>
													{dayNum ? Number(dayNum[1]) : ""}
												</button>
											);
										});
									})}
								</div>
							</section>
						);
					})}
				</div>
			</div>
		</div>
	);
}
