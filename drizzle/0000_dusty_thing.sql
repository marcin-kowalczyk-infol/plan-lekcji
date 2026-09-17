CREATE TABLE `attempts` (
	`id` integer PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL
);
