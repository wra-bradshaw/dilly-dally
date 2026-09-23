import {
	convertSlotZone,
	formatSlotLabel,
	formatSlotWithDate,
} from "#/lib/time-slots";

interface GridCell {
	id: string;
	label: string;
	hourStart: boolean;
	display: string;
	dayShift: number;
}

export interface GridColumn {
	date: string;
	header: string;
	subheader: string;
	cells: GridCell[];
	viewerDates: string[];
	viewerNote: string;
}

export interface DayGap {
	afterIndex: number;
	afterDate: string;
	beforeDate: string;
	skipped: number;
}

function headerFor(date: string): { header: string; subheader: string } {
	const [y, m, d] = date.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	const header = dt.toLocaleDateString("en-US", {
		month: "numeric",
		day: "numeric",
		timeZone: "UTC",
		weekday: "short",
	});
	const subheader = dt.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
	return { header, subheader };
}

function dateToMs(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return Date.UTC(y, m - 1, d);
}

function dayShiftFor(eventDate: string, displayDate: string): number {
	return Math.round((dateToMs(displayDate) - dateToMs(eventDate)) / 86400000);
}

function shortViewerDate(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

export function gridRectangleIds(
	columns: GridColumn[],
	from: string,
	to: string,
): string[] {
	const pos = new Map<string, { c: number; r: number }>();
	columns.forEach((col, c) => {
		col.cells.forEach((cell, r) => {
			pos.set(cell.id, { c, r });
		});
	});
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

export function getDayGaps(columns: { date: string }[]): DayGap[] {
	const dates = [...new Set(columns.map((c) => c.date))].sort();
	const gaps: DayGap[] = [];
	const indexByDate = new Map<string, number>();
	columns.forEach((c, i) => {
		if (!indexByDate.has(c.date)) indexByDate.set(c.date, i);
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
	dates: string[] | Set<string> | { date: string }[],
): string {
	const list = Array.isArray(dates)
		? dates.map((d) => (typeof d === "string" ? d : d.date))
		: [...dates].map((d) =>
				typeof d === "string" ? d : (d as { date: string }).date,
			);
	const uniq = [...new Set(list)].sort();
	if (uniq.length === 0) return "No dates selected.";
	const gaps = getDayGaps(uniq.map((date) => ({ date })));
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
	return formatSlotWithDate(convertSlotZone(slot, eventTimezone, viewTimezone));
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
		const displayDate = display.slice(0, 10);
		const shift = dayShiftFor(eventDate, displayDate);
		const base = formatSlotLabel(display);
		const label =
			shift === 0 ? base : `${base} ${shift > 0 ? `+${shift}d` : `${shift}d`}`;
		const minutes = display.slice(14, 16);
		const list = byEventDate.get(eventDate) ?? [];
		list.push({
			dayShift: shift,
			display,
			hourStart: minutes === "00",
			id,
			label,
		});
		byEventDate.set(eventDate, list);
	}
	const sameZone = eventTimezone === viewTimezone;
	return [...byEventDate.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([date, cells]) => {
			const viewerDates = [
				...new Set(cells.map((c) => c.display.slice(0, 10))),
			].sort();
			const viewerNote = sameZone
				? ""
				: `Shows as ${viewerDates.map(shortViewerDate).join(", ")}`;
			return { cells, date, viewerDates, viewerNote, ...headerFor(date) };
		});
}
