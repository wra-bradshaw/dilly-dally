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
