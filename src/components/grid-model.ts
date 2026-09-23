import {
	convertSlotZone,
	formatSlotLabel,
	formatSlotWithDate,
	formatWeeklySlot,
	isWeeklySlotId,
	weekdayForCode,
} from "#/lib/time-slots";

export interface GridCell {
	id: string;
	label: string;
	hourStart: boolean;
	display: string;
}

export interface GridColumn {
	key: string;
	header: string;
	cells: GridCell[];
}

interface DayGap {
	afterIndex: number;
	afterDate: string;
	beforeDate: string;
	skipped: number;
}

export interface DateMarker {
	rowIndex: number;
	viewerDate: string;
	label: string;
}

type TimeRow =
	| { kind: "cells"; rowIndex: number }
	| { kind: "markers"; markers: (DateMarker | null)[] };

export function headerForWeekday(weekday: number): string {
	if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
		return `Day ${weekday}`;
	}
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		weekday: "short",
	}).format(new Date(Date.UTC(2000, 0, 2 + weekday)));
}

export function weekdayFullName(weekday: number): string {
	if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
		return `Day ${weekday}`;
	}
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		weekday: "long",
	}).format(new Date(Date.UTC(2000, 0, 2 + weekday)));
}

export function summarizeWeekdays(weekdays: number[]): string {
	const uniq = [...new Set(weekdays)]
		.filter((w) => Number.isInteger(w) && w >= 0 && w <= 6)
		.sort((a, b) => a - b);
	if (uniq.length === 0) return "No weekdays selected.";
	const first = uniq[0] as number;
	const last = uniq[uniq.length - 1] as number;
	let groups = 1;
	for (let i = 1; i < uniq.length; i++) {
		if ((uniq[i] as number) - (uniq[i - 1] as number) > 1) groups++;
	}
	const skipped = last - first + 1 - uniq.length;
	const dayWord = uniq.length === 1 ? "weekday" : "weekdays";
	if (groups === 1) {
		return `Showing ${uniq.length} ${dayWord} in 1 group.`;
	}
	const skippedWord = skipped === 1 ? "day" : "days";
	return `Showing ${uniq.length} ${dayWord} in ${groups} groups, ${skipped} ${skippedWord} skipped.`;
}

export function formatMarkerDate(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	return new Intl.DateTimeFormat("en-US", {
		day: "numeric",
		month: "numeric",
		timeZone: "UTC",
		weekday: "short",
	}).format(dt);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function segmentDateFor(column: GridColumn, cell: GridCell): string {
	const candidate = cell.display.slice(0, 10);
	if (DATE_RE.test(candidate)) return candidate;
	return column.key;
}

function markerLabelFor(column: GridColumn, viewerDate: string): string {
	if (DATE_RE.test(viewerDate)) return formatMarkerDate(viewerDate);
	return column.header;
}

export function getDateBreaks(column: GridColumn): DateMarker[] {
	const breaks: DateMarker[] = [];
	let prev: string | null = null;
	column.cells.forEach((cell, rowIndex) => {
		const viewerDate = segmentDateFor(column, cell);
		if (viewerDate !== prev) {
			breaks.push({
				label: markerLabelFor(column, viewerDate),
				rowIndex,
				viewerDate,
			});
			prev = viewerDate;
		}
	});
	return breaks;
}

export function segmentForCell(
	breaks: DateMarker[],
	rowIndex: number,
): DateMarker | null {
	let current: DateMarker | null = null;
	for (const b of breaks) {
		if (b.rowIndex <= rowIndex) current = b;
		else break;
	}
	return current;
}

export function buildTimeRows(columns: GridColumn[]): TimeRow[] {
	const breaksByCol = columns.map((c) => getDateBreaks(c));
	const breakRows = new Map<number, Map<number, DateMarker>>();
	breaksByCol.forEach((breaks, colIndex) => {
		for (const b of breaks) {
			let at = breakRows.get(b.rowIndex);
			if (!at) {
				at = new Map();
				breakRows.set(b.rowIndex, at);
			}
			at.set(colIndex, b);
		}
	});
	const rowCount = columns.reduce((n, c) => Math.max(n, c.cells.length), 0);
	const rows: TimeRow[] = [];
	for (let r = 0; r < rowCount; r++) {
		const at = breakRows.get(r);
		if (at) {
			rows.push({
				kind: "markers",
				markers: columns.map((_, c) => at.get(c) ?? null),
			});
		}
		rows.push({ kind: "cells", rowIndex: r });
	}
	return rows;
}

function dateToMs(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

export type GridPos = Map<string, { c: number; r: number }>;

export function buildGridPos(columns: GridColumn[]): GridPos {
	const pos = new Map<string, { c: number; r: number }>();
	columns.forEach((col, c) => {
		col.cells.forEach((cell, r) => {
			pos.set(cell.id, { c, r });
		});
	});
	return pos;
}

export function gridRectangleIdsFromPos(
	columns: GridColumn[],
	pos: GridPos,
	from: string,
	to: string,
): string[] {
	const a = pos.get(from);
	const b = pos.get(to);
	if (!a || !b) return [];
	const c0 = Math.min(a.c, b.c);
	const c1 = Math.max(a.c, b.c);
	const r0 = Math.min(a.r, b.r);
	const r1 = Math.max(a.r, b.r);
	const out: string[] = [];
	for (let c = c0; c <= c1; c++) {
		const cells = columns[c]?.cells ?? [];
		for (let r = r0; r <= r1; r++) {
			const id = cells[r]?.id;
			if (id) out.push(id);
		}
	}
	return out;
}

export function getDayGaps(columns: { key: string }[]): DayGap[] {
	const dates = [...new Set(columns.map((c) => c.key))].sort();
	const gaps: DayGap[] = [];
	const indexByDate = new Map<string, number>();
	columns.forEach((c, i) => {
		if (!indexByDate.has(c.key)) indexByDate.set(c.key, i);
	});
	for (let i = 0; i < dates.length - 1; i++) {
		const a = dates[i];
		const b = dates[i + 1];
		const skipped = Math.round((dateToMs(b) - dateToMs(a)) / 86400000) - 1;
		if (skipped > 0) {
			gaps.push({
				afterDate: a,
				afterIndex: indexByDate.get(a) ?? i,
				beforeDate: b,
				skipped,
			});
		}
	}
	return gaps;
}

export function summarizeDates(
	dates: string[] | Set<string> | { key: string }[],
): string {
	const list = Array.isArray(dates)
		? dates.map((d) => (typeof d === "string" ? d : d.key))
		: [...dates].map((d) =>
				typeof d === "string" ? d : (d as { key: string }).key,
			);
	if (list.length > 0 && list.every((d) => !DATE_RE.test(d))) {
		return summarizeWeekdays(
			list.map((d) => weekdayForCode(d)).filter((w): w is number => w !== null),
		);
	}
	const uniq = [...new Set(list)].sort();
	if (uniq.length === 0) return "No dates selected.";
	const gaps = getDayGaps(uniq.map((key) => ({ key })));
	const groups = gaps.length + 1;
	const skipped = gaps.reduce((n, g) => n + g.skipped, 0);
	const dayWord = uniq.length === 1 ? "day" : "days";
	if (groups === 1) {
		return `Showing ${uniq.length} ${dayWord} in 1 group.`;
	}
	const skippedWord = skipped === 1 ? "day" : "days";
	return `Showing ${uniq.length} ${dayWord} in ${groups} groups, ${skipped} ${skippedWord} skipped.`;
}

export function formatViewerSlot(
	slot: string,
	eventTimezone: string,
	viewTimezone: string,
): string {
	if (isWeeklySlotId(slot)) return formatWeeklySlot(slot);
	return formatSlotWithDate(convertSlotZone(slot, eventTimezone, viewTimezone));
}

export function buildWeeklyColumns(universe: string[]): GridColumn[] {
	const byWeekday = new Map<number, GridCell[]>();
	for (const id of universe) {
		if (!isWeeklySlotId(id)) continue;
		const dash = id.indexOf("-");
		const weekday = weekdayForCode(id.slice(0, dash));
		if (weekday === null) continue;
		const time = id.slice(dash + 1);
		const minutes = time.slice(3, 5);
		const list = byWeekday.get(weekday) ?? [];
		list.push({
			display: id,
			hourStart: minutes === "00",
			id,
			label: formatSlotLabel(`2000-01-01T${time}`),
		});
		byWeekday.set(weekday, list);
	}
	return [...byWeekday.entries()]
		.sort(([a], [b]) => a - b)
		.map(([weekday, cells]) => {
			const code = cells[0]?.id.slice(0, cells[0].id.indexOf("-")) ?? "";
			return {
				cells,
				key: code,
				header: headerForWeekday(weekday),
			};
		});
}

export function buildColumns(
	universe: string[],
	eventTimezone: string,
	viewTimezone: string,
): GridColumn[] {
	const byEventDate = new Map<string, GridCell[]>();
	for (const id of universe) {
		const eventDate = id.slice(0, 10);
		const display = convertSlotZone(id, eventTimezone, viewTimezone);
		const label = formatSlotLabel(display);
		const minutes = display.slice(14, 16);
		const list = byEventDate.get(eventDate) ?? [];
		list.push({
			display,
			hourStart: minutes === "00",
			id,
			label,
		});
		byEventDate.set(eventDate, list);
	}
	return [...byEventDate.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([date, cells]) => ({
			cells,
			key: date,
			header: formatMarkerDate(date),
		}));
}
