CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`description` text,
	`color` text,
	`creator` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_creator_unq` ON `clients` (`creator`);--> statement-breakpoint
CREATE TABLE `custom_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`image_id` text NOT NULL,
	`tag` text NOT NULL,
	FOREIGN KEY (`image_id`) REFERENCES `images_cache`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_tags_image_id_idx` ON `custom_tags` (`image_id`);--> statement-breakpoint
CREATE INDEX `custom_tags_tag_idx` ON `custom_tags` (`tag`);--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_path_unq` ON `folders` (`path`);--> statement-breakpoint
CREATE INDEX `folders_parent_id_idx` ON `folders` (`parent_id`);--> statement-breakpoint
CREATE TABLE `images_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text,
	`meta` text,
	`require_signed_urls` integer DEFAULT false NOT NULL,
	`uploaded_at` integer,
	`creator` text,
	`variants` text,
	`client_id` text,
	`folder_id` text,
	`folder_path` text,
	`last_synced_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `images_cache_client_id_idx` ON `images_cache` (`client_id`);--> statement-breakpoint
CREATE INDEX `images_cache_folder_id_idx` ON `images_cache` (`folder_id`);--> statement-breakpoint
CREATE INDEX `images_cache_folder_path_idx` ON `images_cache` (`folder_path`);--> statement-breakpoint
CREATE INDEX `images_cache_uploaded_at_idx` ON `images_cache` (`uploaded_at`);--> statement-breakpoint
CREATE INDEX `images_cache_filename_idx` ON `images_cache` (`filename`);