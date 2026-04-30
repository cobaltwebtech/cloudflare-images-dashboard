DROP INDEX `custom_tags_image_id_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `custom_tags_image_tag_unq` ON `custom_tags` (`image_id`,`tag`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_images_cache` (
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
	FOREIGN KEY (`folder_id`) REFERENCES `folders`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "images_cache_folder_consistency" CHECK(("__new_images_cache"."folder_id" IS NULL AND "__new_images_cache"."folder_path" IS NULL)
				OR ("__new_images_cache"."folder_id" IS NOT NULL AND "__new_images_cache"."folder_path" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_images_cache`("id", "filename", "meta", "require_signed_urls", "uploaded_at", "creator", "variants", "client_id", "folder_id", "folder_path", "last_synced_at") SELECT "id", "filename", "meta", "require_signed_urls", "uploaded_at", "creator", "variants", "client_id", "folder_id", "folder_path", "last_synced_at" FROM `images_cache`;--> statement-breakpoint
DROP TABLE `images_cache`;--> statement-breakpoint
ALTER TABLE `__new_images_cache` RENAME TO `images_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `images_cache_folder_uploaded_idx` ON `images_cache` (`folder_id`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `images_cache_client_uploaded_idx` ON `images_cache` (`client_id`,`uploaded_at`);--> statement-breakpoint
CREATE INDEX `images_cache_folder_path_idx` ON `images_cache` (`folder_path`);--> statement-breakpoint
CREATE INDEX `images_cache_uploaded_at_idx` ON `images_cache` (`uploaded_at`);--> statement-breakpoint
CREATE INDEX `images_cache_filename_idx` ON `images_cache` (`filename`);