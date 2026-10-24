CREATE TABLE `event_sessions` (
	`created_at` integer NOT NULL,
	`event_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`name_display` text NOT NULL,
	`name_key` text NOT NULL,
	`password_hash` text,
	`token_hash` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_event_sessions_event` ON `event_sessions` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_event_sessions_expires` ON `event_sessions` (`expires_at`);
