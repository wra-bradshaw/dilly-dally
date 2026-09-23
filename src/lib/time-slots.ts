const WEEKLY_SLOT_RE =
	/^(SUN|MON|TUE|WED|THU|FRI|SAT)-([01]\d|2[0-3]):(00|15|30|45)$/;
const HOUR_RE = /^([01]\d|2[0-3]):00$/;

export const WEEKDAY_CODES = [
	"SUN",
	"MON",
	"TUE",
	"WED",
	"THU",
	"FRI",
	"SAT",
] as const;

export type EventMode = "dates" | "weekly";

export function browserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
}

export function allTimezones(): string[] {
	try {
		const supported = (
			Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
		).supportedValuesOf?.("timeZone");
		if (supported && supported.length > 0) return supported;
	} catch {}
	return [browserTimezone()];
}

export function weekdayCode(weekday: number): string | null {
	if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
	return WEEKDAY_CODES[weekday] as string;
}

export function weekdayForCode(code: string): number | null {
	const idx = (WEEKDAY_CODES as readonly string[]).indexOf(code);
	return idx === -1 ? null : idx;
}

export function isWeeklySlotId(slot: string): boolean {
	return WEEKLY_SLOT_RE.test(slot);
}

const wallFormatters = new Map<string, Intl.DateTimeFormat>();

function wallFormatter(tz: string): Intl.DateTimeFormat {
	const cached = wallFormatters.get(tz);
	if (cached) return cached;
	const fmt = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		month: "2-digit",
		timeZone: tz,
		year: "numeric",
	});
	wallFormatters.set(tz, fmt);
	return fmt;
}

const slotLabelFormatter = new Intl.DateTimeFormat("en-US", {
	hour: "numeric",
	minute: "2-digit",
	timeZone: "UTC",
});
const weekdayShortFormatter = new Intl.DateTimeFormat("en-US", {
	timeZone: "UTC",
	weekday: "short",
});
const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});

function wallInZone(ms: number, tz: string): number {
	const parts = wallFormatter(tz).formatToParts(ms);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	const asUtc = Date.UTC(
		Number(get("year")),
		Number(get("month")) - 1,
		Number(get("day")),
		Number(get("hour")) === 24 ? 0 : Number(get("hour")),
		Number(get("minute")),
	);
	return asUtc - ms;
}

export function slotToInstant(slot: string, tz: string): number {
	const [date, time] = slot.split("T");
	const [y, mo, d] = date.split("-").map(Number);
	const [h, mi] = time.split(":").map(Number);
	const guess = Date.UTC(y, mo - 1, d, h, mi);
	return guess - wallInZone(guess - wallInZone(guess, tz), tz);
}

export function instantToSlot(ms: number, tz: string): string {
	const parts = wallFormatter(tz).formatToParts(ms);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	const hour = get("hour") === "24" ? "00" : get("hour");
	return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

export function convertSlotZone(
	slot: string,
	fromTz: string,
	toTz: string,
): string {
	if (fromTz === toTz) return slot;
	return instantToSlot(slotToInstant(slot, fromTz), toTz);
}

export function formatSlotLabel(slot: string): string {
	const [, time] = slot.split("T");
	const [hh, mm] = time.split(":").map(Number);
	return slotLabelFormatter.format(new Date(Date.UTC(2000, 0, 1, hh, mm)));
}

function weekdayShortForCode(code: string): string {
	const idx = weekdayForCode(code);
	if (idx === null) return code;
	return weekdayShortFormatter.format(new Date(Date.UTC(2000, 0, 2 + idx)));
}

export function formatWeeklySlot(slot: string): string {
	const dash = slot.indexOf("-");
	if (dash === -1 || !isWeeklySlotId(slot)) return slot;
	const code = slot.slice(0, dash);
	const time = slot.slice(dash + 1);
	return `${weekdayShortForCode(code)}, ${formatSlotLabel(`2000-01-01T${time}`)}`;
}

function weeklySlotRank(slot: string): number | null {
	const dash = slot.indexOf("-");
	if (dash === -1 || !isWeeklySlotId(slot)) return null;
	const idx = weekdayForCode(slot.slice(0, dash));
	if (idx === null) return null;
	const [h, m] = slot
		.slice(dash + 1)
		.split(":")
		.map(Number);
	return idx * 24 * 60 + h * 60 + m;
}

export function formatSlotWithDate(slot: string): string {
	const [date] = slot.split("T");
	const [y, m, d] = date.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	const monthDay = monthDayFormatter.format(dt);
	return `${monthDay}, ${formatSlotLabel(slot)}`;
}

interface SlotUniverseInput {
	dates?: string[];
	startTime: string;
	endTime: string;
}

interface WeeklyUniverseInput {
	weekdays: number[];
	startTime: string;
	endTime: string;
}

function hourToMinutes(t: string): number | null {
	if (!HOUR_RE.test(t)) return null;
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

export function buildSlotUniverse(input: SlotUniverseInput): string[] {
	const start = hourToMinutes(input.startTime);
	const end = hourToMinutes(input.endTime);
	if (start === null || end === null) return [];
	if (start >= end) return [];
	const dates = [...new Set(input.dates ?? [])].sort();
	const out: string[] = [];
	for (const date of dates) {
		for (let mins = start; mins < end; mins += 15) {
			const h = String(Math.floor(mins / 60)).padStart(2, "0");
			const mm = String(mins % 60).padStart(2, "0");
			out.push(`${date}T${h}:${mm}`);
		}
	}
	return out;
}

export function buildWeeklyUniverse(input: WeeklyUniverseInput): string[] {
	const start = hourToMinutes(input.startTime);
	const end = hourToMinutes(input.endTime);
	if (start === null || end === null) return [];
	if (start >= end) return [];
	const weekdays = [...new Set(input.weekdays)]
		.filter((w) => Number.isInteger(w) && w >= 0 && w <= 6)
		.sort((a, b) => a - b);
	const out: string[] = [];
	for (const weekday of weekdays) {
		const code = weekdayCode(weekday);
		if (code === null) continue;
		for (let mins = start; mins < end; mins += 15) {
			const h = String(Math.floor(mins / 60)).padStart(2, "0");
			const mm = String(mins % 60).padStart(2, "0");
			out.push(`${code}-${h}:${mm}`);
		}
	}
	return out;
}

export function buildEventUniverse(event: {
	mode?: EventMode;
	dates: string[];
	weekdays?: number[];
	startTime: string;
	endTime: string;
}): string[] {
	if ((event.mode ?? "dates") === "weekly") {
		return buildWeeklyUniverse({
			endTime: event.endTime,
			startTime: event.startTime,
			weekdays: event.weekdays ?? [],
		});
	}
	return buildSlotUniverse({
		dates: event.dates,
		endTime: event.endTime,
		startTime: event.startTime,
	});
}

export function normalizeSlots(slots: string[]): string[] {
	return [...new Set(slots)].sort();
}

interface ParticipantSlots {
	name: string;
	slots: string[];
}

interface SlotCount {
	slot: string;
	count: number;
	names: string[];
}

export function computeCounts(
	universe: string[],
	participants: ParticipantSlots[],
): SlotCount[] {
	const sets = participants.map((p) => ({
		name: p.name,
		set: new Set(p.slots),
	}));
	return universe.map((slot) => {
		const names: string[] = [];
		for (const p of sets) {
			if (p.set.has(slot)) names.push(p.name);
		}
		names.sort((a, b) => a.localeCompare(b));
		return { count: names.length, names, slot };
	});
}

export function findBestTimes(counts: SlotCount[], limit: number): SlotCount[] {
	return [...counts]
		.sort((a, b) => {
			if (b.count !== a.count) return b.count - a.count;
			const ar = weeklySlotRank(a.slot);
			const br = weeklySlotRank(b.slot);
			if (ar !== null && br !== null) return ar - br;
			return a.slot < b.slot ? -1 : 1;
		})
		.slice(0, limit);
}
