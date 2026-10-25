import "zod-openapi";
import { z } from "zod";
import { DAY_MS, EVENT_MAX_FUTURE_DAYS } from "./expiry";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const hourRe = /^([01]\d|2[0-3]):(00|30)$/;
const slotRe = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):(00|30)$/;
const weeklySlotRe = /^(SUN|MON|TUE|WED|THU|FRI|SAT)-([01]\d|2[0-3]):(00|30)$/;

function stripAnchors(source: string): string {
	return source.replace(/^\^/, "").replace(/\$$/, "");
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

export const eventModeSchema = z.enum(["dates", "weekly"]).meta({
	description: "dates picks specific dates; weekly repeats on weekdays.",
	example: "dates",
	id: "EventMode",
});

export const weekdaySchema = z.number().int().min(0).max(6).meta({
	description: "Day of week, 0=Sunday through 6=Saturday.",
	example: 1,
	id: "Weekday",
});

export const slotIdSchema = z
	.string()
	.regex(
		new RegExp(
			`^(${stripAnchors(slotRe.source)}|${stripAnchors(weeklySlotRe.source)})$`,
		),
	)
	.meta({
		description:
			"Slot id in event-timezone wall time. Date events use YYYY-MM-DDTHH:mm; weekly events use DOW-HH:mm like MON-09:30.",
		example: "2026-10-05T09:30",
		id: "SlotId",
	});

export const weeklySlotIdSchema = z.string().regex(weeklySlotRe).meta({
	description:
		"Weekly slot id: weekday code plus HH:mm. Monday is MON, Sunday is SUN.",
	example: "MON-09:30",
	id: "WeeklySlotId",
});

const datesField = z
	.array(
		z.string().regex(dateRe).refine(isRealDate).refine(isInDateWindow, {
			message: "Dates must be today or future, within 90 days",
		}),
	)
	.min(1)
	.max(31)
	.meta({
		description:
			"1..31 entries, YYYY-MM-DD, each today (UTC) through today+90 inclusive. Required when mode is dates (the default). Omit or send [] for weekly events.",
	});

export const MAX_POLLS_PER_EVENT = 10;
export const MAX_OPTIONS_PER_POLL = 10;

const timezoneSchema = z
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
	);

function toMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

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
		allowMultiple: z.boolean().optional().default(false).meta({
			description:
				"When true voters may pick multiple options, otherwise single choice.",
		}),
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
	})
	.meta({ id: "CreatePollRequest" });

export const createPollSchema = pollDraftSchema;

export const addPollOptionSchema = z
	.object({
		label: pollOptionLabelSchema,
	})
	.meta({ id: "AddPollOptionRequest" });

export const pollVoteSchema = z
	.object({
		name: participantNameSchema,
		optionIds: z
			.array(z.string().min(1).max(64))
			.max(MAX_OPTIONS_PER_POLL)
			.meta({
				description:
					"Full replace set of option ids for this poll. Empty array clears the vote.",
			}),
		password: z.string().min(4).max(72).optional().meta({
			description:
				"Optional password, same identity as availability. Required when the name is password-protected.",
		}),
	})
	.meta({ id: "PollVoteRequest" });

export const createEventSchema = z
	.object({
		dates: datesField.optional(),
		endTime: z.string().regex(hourRe).meta({ example: "17:00" }),
		mode: eventModeSchema.optional().default("dates"),
		polls: z.array(createPollSchema).max(MAX_POLLS_PER_EVENT).optional().meta({
			description:
				"Optional 0..10 polls created with the event. Each needs question 1..140 chars and 2..10 unique options 1..80 chars.",
		}),
		startTime: z.string().regex(hourRe).meta({ example: "09:00" }),
		timezone: timezoneSchema.meta({ example: "America/New_York" }),
		title: z.string().trim().min(1).max(100),
		weekdays: z.array(weekdaySchema).max(7).optional().meta({
			description:
				"Required when mode is weekly. 1..7 unique entries, 0=Sunday through 6=Saturday. Example [1,3,5] means Mon/Wed/Fri.",
		}),
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
	)
	.meta({ id: "CreateEventRequest" });

export const eventFormSchema = z
	.object({
		dates: z.array(z.string()).optional(),
		endTime: z.string().regex(hourRe),
		mode: eventModeSchema.optional().default("dates"),
		polls: z.array(createPollSchema).max(MAX_POLLS_PER_EVENT).optional(),
		startTime: z.string().regex(hourRe),
		timezone: timezoneSchema,
		title: z.string().trim().min(1).max(100),
		weekdays: z.array(weekdaySchema).optional(),
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
		if ((v.mode ?? "dates") === "weekly") {
			if ((v.weekdays ?? []).length === 0) {
				ctx.addIssue({
					code: "custom",
					message: "Weekly events need at least one weekday",
					path: ["weekdays"],
				});
			}
		} else if ((v.dates ?? []).length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Pick at least one date",
				path: ["dates"],
			});
		}
	})
	.refine((v) => toMinutes(v.startTime) < toMinutes(v.endTime), {
		message: "End time must be after start time",
		path: ["endTime"],
	});

export const availabilitySchema = z
	.object({
		name: participantNameSchema,
		password: z.string().min(4).max(72).optional().meta({
			description:
				"Optional password. Sent only over HTTPS, never stored in plain text.",
		}),
		slots: z.array(slotIdSchema).max(2852).meta({
			description:
				"Full replace set of slot ids. Date events use YYYY-MM-DDTHH:mm; weekly events use DOW-HH:mm like MON-09:30. Empty array means unavailable everywhere.",
		}),
	})
	.meta({ id: "AvailabilityRequest" });

export const sessionCreateSchema = z
	.object({
		name: participantNameSchema,
		password: z.string().min(4).max(72).optional().meta({
			description:
				"Optional password, required when the name is password-protected. Never stored, only used to mint a short-lived session cookie.",
		}),
	})
	.meta({ id: "SessionRequest" });

export const availabilityResponseSchema = z
	.object({
		count: z.number().int(),
		name: z.string(),
		protected: z.boolean(),
		updatedAt: z.string(),
	})
	.meta({ id: "AvailabilityResponse" });

export const pollOptionSchema = z
	.object({
		count: z.number().int(),
		id: z.string(),
		label: z.string(),
		names: z.array(z.string()),
	})
	.meta({ id: "PollOption" });

export const pollSchema = z
	.object({
		allowMultiple: z.boolean(),
		id: z.string(),
		options: z.array(pollOptionSchema),
		question: z.string(),
		totalVoters: z.number().int(),
	})
	.meta({ id: "Poll" });

export const createPollResponseSchema = z
	.object({ poll: pollSchema })
	.meta({ id: "CreatePollResponse" });

export const addPollOptionResponseSchema = z
	.object({ id: z.string(), label: z.string() })
	.meta({ id: "AddPollOptionResponse" });

export const pollVoteResponseSchema = z
	.object({ pollId: z.string() })
	.meta({ id: "PollVoteResponse" });

export const eventSchema = z
	.object({
		createdAt: z.string(),
		dates: z.array(z.string()).meta({
			description:
				"Specific dates for dates events; empty array for weekly events.",
		}),
		endTime: z.string(),
		expiresAt: z.string(),
		id: z.string(),
		mode: eventModeSchema,
		startTime: z.string(),
		timezone: z.string(),
		title: z.string(),
		weekdays: z.array(weekdaySchema).meta({
			description:
				"Weekdays for weekly events, 0=Sunday through 6=Saturday; empty array for dates events.",
		}),
	})
	.meta({ id: "Event" });

export const createEventResponseSchema = z
	.object({ event: eventSchema, id: z.string(), url: z.string() })
	.meta({ id: "CreateEventResponse" });

export const errorSchema = z
	.object({
		error: z.object({
			code: z.string(),
			fields: z.record(z.string(), z.array(z.string())).optional(),
			message: z.string(),
		}),
	})
	.meta({ id: "Error" });

export const eventDetailResponseSchema = z
	.object({
		bestTimes: z.array(z.object({ count: z.number().int(), slot: z.string() })),
		counts: z.array(
			z.object({
				count: z.number().int(),
				names: z.array(z.string()),
				slot: z.string(),
			}),
		),
		event: eventSchema,
		participants: z.array(
			z.object({
				count: z.number().int(),
				name: z.string(),
				updatedAt: z.string(),
			}),
		),
		polls: z.array(pollSchema).meta({
			description:
				"Polls for this event, each with public vote counts and voter names.",
		}),
		slotUniverse: z.array(z.string()),
	})
	.meta({ id: "EventDetailResponse" });

export const ownAvailabilityResponseSchema = z
	.object({ name: z.string(), slots: z.array(z.string()) })
	.meta({ id: "OwnAvailabilityResponse" });

export const sessionResponseSchema = z
	.object({ name: z.string() })
	.meta({ id: "SessionResponse" });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type CreatePollInput = z.input<typeof createPollSchema>;
export type PollVoteInput = z.infer<typeof pollVoteSchema>;
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
