CREATE TABLE `poll_options` (
	`created_at` integer NOT NULL,
	`event_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`poll_id` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_poll_options_poll` ON `poll_options` (`poll_id`);--> statement-breakpoint
CREATE INDEX `idx_poll_options_event` ON `poll_options` (`event_id`);--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`event_id` text NOT NULL,
	`name_display` text NOT NULL,
	`name_key` text NOT NULL,
	`option_id` text NOT NULL,
	`poll_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`poll_id`, `option_id`, `name_key`),
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `poll_options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_poll_votes_event` ON `poll_votes` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_poll_votes_option` ON `poll_votes` (`option_id`);--> statement-breakpoint
CREATE TABLE `polls` (
	`allow_multiple` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`event_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`question` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_polls_event` ON `polls` (`event_id`);