import { z } from "zod";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const hourRe = /^([01]\d|2[0-3]):00$/;
const slotRe = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):(00|15|30|45)$/;

const DAY_MS = 24 * 60 * 60 * 1000;

function isRealDate(s: string): boolean {
	const [y, m, d] = s.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	return (
		dt.getUTCFullYear() === y &&
		dt.getUTCMonth() === m - 1 &&
		dt.getUTCDate() === d
	);
}

function todayUtc(): string {
	return new Date(Date.now()).toISOString().slice(0, 10);
}

function maxDateUtc(): string {
	return new Date(Date.now() + 90 * DAY_MS).toISOString().slice(0, 10);
}

function isInDateWindow(s: string): boolean {
	const min = todayUtc();
	const max = maxDateUtc();
	return s >= min && s <= max;
}

export const participantNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(40)
	.refine((s) => s.length > 0, { message: "Name is required" });

export function nameKey(name: string): string {
	return name.trim().toLowerCase();
}

export const createEventSchema = z
	.object({
		dates: z
			.array(
				z.string().regex(dateRe).refine(isRealDate).refine(isInDateWindow, {
					message: "Dates must be today or future, within 90 days",
				}),
			)
			.min(1)
			.max(31),
		endTime: z.string().regex(hourRe),
		startTime: z.string().regex(hourRe),
		timezone: z
			.string()
			.min(1)
			.max(64)
			.refine(
				(tz) => {
					try {
						Intl.DateTimeFormat(undefined, { timeZone: tz });
						return true;
					} catch {
						return false;
					}
				},
				{ message: "Invalid timezone" },
			),
		title: z.string().trim().min(1).max(100),
	})
	.refine(
		(v) => {
			const [sh, sm] = v.startTime.split(":").map(Number);
			const [eh, em] = v.endTime.split(":").map(Number);
			return sh * 60 + sm < eh * 60 + em;
		},
		{ message: "End time must be after start time", path: ["endTime"] },
	);

export const availabilitySchema = z.object({
	name: participantNameSchema,
	password: z.string().min(4).max(72).optional(),
	slots: z.array(z.string().regex(slotRe)).max(1488),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
