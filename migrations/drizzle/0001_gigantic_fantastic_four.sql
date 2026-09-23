ALTER TABLE `events` ADD `mode` text DEFAULT 'dates' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `weekdays_json` text;