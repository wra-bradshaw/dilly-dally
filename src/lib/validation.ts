import { z } from "zod";
import { DAY_MS, EVENT_MAX_FUTURE_DAYS } from "./expiry";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const hourRe = /^([01]\d|2[0-3]):00$/;
const slotRe = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):(00|15|30|45)$/;
const weeklySlotRe =
	/^(SUN|MON|TUE|WED|THU|FRI|SAT)-([01]\d|2[0-3]):(00|15|30|45)$/;

function isSlotId(s: string): boolean {
	return slotRe.test(s) || weeklySlotRe.test(s);
}

function isRealDate(s: string): boolean {
	const [y, m, d] = s.split("-").map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	return (
		dt.getUTCFullYear() === y &&
		dt.getUTCMonth() === m - 1 &&
		dt.getUTCDate() === d
	);
}

function maxDateUtc(): string {
	return new Date(Date.now() + EVENT_MAX_FUTURE_DAYS * DAY_MS)
		.toISOString()
		.slice(0, 10);
}

function minDateUtc(): string {
	return new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
}

function isInDateWindow(s: string): boolean {
	const min = minDateUtc();
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

const eventModeSchema = z.enum(["dates", "weekly"]);

const weekdaySchema = z.number().int().min(0).max(6);

const datesField = z
	.array(
		z.string().regex(dateRe).refine(isRealDate).refine(isInDateWindow, {
			message: "Dates must be today or future, within 90 days",
		}),
	)
	.min(1)
	.max(31);

export const createEventSchema = z
	.object({
		dates: datesField.optional(),
		endTime: z.string().regex(hourRe),
		mode: eventModeSchema.optional().default("dates"),
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
		weekdays: z.array(weekdaySchema).max(7).optional(),
	})
	.superRefine((v, ctx) => {
		if (v.mode === "weekly") {
			const days = [...new Set(v.weekdays ?? [])];
			if (days.length === 0) {
				ctx.addIssue({
					code: "custom",
					message: "Weekly events need at least one weekday",
					path: ["weekdays"],
				});
			}
			if ((v.weekdays ?? []).length !== days.length) {
				ctx.addIssue({
					code: "custom",
					message: "Weekdays must be unique",
					path: ["weekdays"],
				});
			}
			if (v.dates !== undefined && v.dates.length > 0) {
				ctx.addIssue({
					code: "custom",
					message: "Weekly events use weekdays, not dates",
					path: ["dates"],
				});
			}
		} else {
			if (!v.dates || v.dates.length === 0) {
				ctx.addIssue({
					code: "custom",
					message: "Pick at least one date",
					path: ["dates"],
				});
			}
		}
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
	slots: z.array(z.string().refine(isSlotId)).max(2852),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
