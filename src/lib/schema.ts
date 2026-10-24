import {
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
	"events",
	{
		createdAt: integer("created_at").notNull(),
		datesJson: text("dates_json").notNull(),
		endTime: text("end_time").notNull(),
		expiresAt: integer("expires_at").notNull(),
		id: text("id").primaryKey(),
		mode: text("mode").notNull().default("dates"),
		startTime: text("start_time").notNull(),
		timezone: text("timezone").notNull(),
		title: text("title").notNull(),
		weekdaysJson: text("weekdays_json"),
	},
	(t) => [index("idx_events_expires").on(t.expiresAt)],
);

export const polls = sqliteTable(
	"polls",
	{
		allowMultiple: integer("allow_multiple").notNull().default(0),
		createdAt: integer("created_at").notNull(),
		eventId: text("event_id").notNull(),
		id: text("id").primaryKey(),
		position: integer("position").notNull(),
		question: text("question").notNull(),
	},
	(t) => [
		index("idx_polls_event").on(t.eventId),
		foreignKey({
			columns: [t.eventId],
			foreignColumns: [events.id],
			name: "polls_event_id_fk",
		}).onDelete("cascade"),
	],
);

export const pollOptions = sqliteTable(
	"poll_options",
	{
		createdAt: integer("created_at").notNull(),
		eventId: text("event_id").notNull(),
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		pollId: text("poll_id").notNull(),
		position: integer("position").notNull(),
	},
	(t) => [
		index("idx_poll_options_poll").on(t.pollId),
		index("idx_poll_options_event").on(t.eventId),
		foreignKey({
			columns: [t.pollId],
			foreignColumns: [polls.id],
			name: "poll_options_poll_id_fk",
		}).onDelete("cascade"),
	],
);

export const pollVotes = sqliteTable(
	"poll_votes",
	{
		eventId: text("event_id").notNull(),
		nameDisplay: text("name_display").notNull(),
		nameKey: text("name_key").notNull(),
		optionId: text("option_id").notNull(),
		pollId: text("poll_id").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.pollId, t.optionId, t.nameKey] }),
		index("idx_poll_votes_event").on(t.eventId),
		index("idx_poll_votes_option").on(t.optionId),
		foreignKey({
			columns: [t.pollId],
			foreignColumns: [polls.id],
			name: "poll_votes_poll_id_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.optionId],
			foreignColumns: [pollOptions.id],
			name: "poll_votes_option_id_fk",
		}).onDelete("cascade"),
	],
);
export const participants = sqliteTable(
	"participants",
	{
		eventId: text("event_id").notNull(),
		nameDisplay: text("name_display").notNull(),
		nameKey: text("name_key").notNull(),
		passwordHash: text("password_hash"),
		slotsJson: text("slots_json").notNull(),
		updatedAt: integer("updated_at").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.eventId, t.nameKey] }),
		index("idx_participants_event").on(t.eventId),
		foreignKey({
			columns: [t.eventId],
			foreignColumns: [events.id],
			name: "participants_event_id_fk",
		}).onDelete("cascade"),
	],
);
