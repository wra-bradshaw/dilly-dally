CREATE TABLE `events` (
	`created_at` integer NOT NULL,
	`dates_json` text NOT NULL,
	`end_time` text NOT NULL,
	`expires_at` integer NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`start_time` text NOT NULL,
	`timezone` text NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_expires` ON `events` (`expires_at`);--> statement-breakpoint
CREATE TABLE `participants` (
	`event_id` text NOT NULL,
	`name_display` text NOT NULL,
	`name_key` text NOT NULL,
	`password_hash` text,
	`slots_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `name_key`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_participants_event` ON `participants` (`event_id`);--> statement-breakpoint
CREATE TABLE `rate_counters` (
	`count` integer NOT NULL,
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL
);
