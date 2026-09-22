import { convertSlotZone, formatSlotLabel } from "#/lib/time-slots";

interface GridCell {
	id: string;
	label: string;
	hourStart: boolean;
}

export interface GridColumn {
	date: string;
	header: string;
	subheader: string;
	cells: GridCell[];
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

export function buildColumns(
	universe: string[],
	eventTimezone: string,
	viewTimezone: string,
): GridColumn[] {
	const byDate = new Map<string, GridCell[]>();
	for (const id of universe) {
		const display = convertSlotZone(id, eventTimezone, viewTimezone);
		const date = display.slice(0, 10);
		const minutes = display.slice(14, 16);
		const list = byDate.get(date) ?? [];
		list.push({
			hourStart: minutes === "00",
			id,
			label: formatSlotLabel(display),
		});
		byDate.set(date, list);
	}
	return [...byDate.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([date, cells]) => ({ cells, date, ...headerFor(date) }));
}
