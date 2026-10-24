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

export const MAX_POLLS_PER_EVENT = 10;
export const MAX_OPTIONS_PER_POLL = 10;

const pollQuestionSchema = z.string().trim().min(1).max(140);

const pollOptionLabelSchema = z.string().trim().min(1).max(80);

function hasDuplicateOptions(options: string[]): boolean {
	const seen = new Set<string>();
	for (const raw of options) {
		const key = raw.trim().toLowerCase();
		if (seen.has(key)) return true;
		seen.add(key);
	}
	return false;
}

const pollDraftSchema = z
	.object({
		allowMultiple: z.boolean().optional().default(false),
		options: z.array(pollOptionLabelSchema).min(2).max(MAX_OPTIONS_PER_POLL),
		question: pollQuestionSchema,
	})
	.superRefine((v, ctx) => {
		if (hasDuplicateOptions(v.options)) {
			ctx.addIssue({
				code: "custom",
				message: "Poll options must be unique",
				path: ["options"],
			});
		}
	});

export const createPollSchema = pollDraftSchema;

export const addPollOptionSchema = z.object({
	label: pollOptionLabelSchema,
});

export const pollVoteSchema = z.object({
	name: participantNameSchema,
	optionIds: z.array(z.string().min(1).max(64)).max(MAX_OPTIONS_PER_POLL),
	password: z.string().min(4).max(72).optional(),
});

export const createEventSchema = z
	.object({
		dates: datesField.optional(),
		endTime: z.string().regex(hourRe),
		mode: eventModeSchema.optional().default("dates"),
		polls: z.array(createPollSchema).max(MAX_POLLS_PER_EVENT).optional(),
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
		if (v.polls !== undefined) {
			const seen = new Set<string>();
			for (const p of v.polls) {
				const key = p.question.trim().toLowerCase();
				if (seen.has(key)) {
					ctx.addIssue({
						code: "custom",
						message: "Poll questions must be unique",
						path: ["polls"],
					});
					break;
				}
				seen.add(key);
			}
		}
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
export type CreatePollInput = z.input<typeof createPollSchema>;
export type PollVoteInput = z.infer<typeof pollVoteSchema>;
