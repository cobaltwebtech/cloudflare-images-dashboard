import { sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Client profiles. Used to group images by the end-customer the assets belong to.
 *
 * - `creator` mirrors the Cloudflare Images `creator` field. When set, any image
 *   whose CF `creator` matches this value is automatically linked to the client
 *   (see `linkImagesByCreator` in `server/clients.ts` and `server/images.ts`).
 *   Enforced unique so a creator string maps to at most one client.
 */
export const clients = sqliteTable(
	"clients",
	{
		id: text("id").primaryKey(), // nanoid
		name: text("name").notNull(),
		website: text("website"),
		description: text("description"),
		color: text("color"), // hex swatch for UI
		creator: text("creator"), // CF Images `creator` value to auto-link images by
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("clients_creator_unq").on(t.creator)],
);

/**
 * Hierarchical folders for organizing images. Cloudflare Images stores everything
 * flat, so we maintain the tree locally.
 *
 * - `parentId` enables tree traversal and renames.
 * - `path` is the denormalized full slash-delimited path (e.g. `/acme/logos`)
 *   used for fast breadcrumbs, prefix queries, and unique-path enforcement.
 *   Always starts with `/`. Root-level folders have `parentId = null`.
 *   Must be kept in sync with `parentId` on insert/move (handled in server fns).
 */
export const folders = sqliteTable(
	"folders",
	{
		id: text("id").primaryKey(), // nanoid
		name: text("name").notNull(), // single segment, no slashes
		parentId: text("parent_id").references((): AnySQLiteColumn => folders.id, {
			onDelete: "cascade",
		}),
		path: text("path").notNull(), // e.g. "/acme/logos"
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		uniqueIndex("folders_path_unq").on(t.path),
		index("folders_parent_id_idx").on(t.parentId),
	],
);

/**
 * Local cache of Cloudflare Images records. Synced on demand from the CF API
 * to power fast search/filter without paginating CF on every request.
 */
export const imagesCache = sqliteTable(
	"images_cache",
	{
		id: text("id").primaryKey(), // CF image ID
		filename: text("filename"),
		meta: text("meta"), // JSON-encoded user metadata from CF
		requireSignedUrls: integer("require_signed_urls", { mode: "boolean" })
			.notNull()
			.default(false),
		uploadedAt: integer("uploaded_at", { mode: "timestamp" }),
		creator: text("creator"),
		variants: text("variants"), // JSON-encoded array of variant URLs
		clientId: text("client_id").references(() => clients.id, {
			onDelete: "set null",
		}),
		/**
		 * Folder this image lives in. `null` means root (no folder).
		 * On folder delete, images are moved to root rather than deleted.
		 */
		folderId: text("folder_id").references(() => folders.id, {
			onDelete: "set null",
		}),
		/**
		 * Denormalized copy of `folders.path` for fast prefix/breadcrumb queries
		 * without a join. `null` for images at root. Server functions must keep
		 * this in sync with `folderId` (and update all descendants on folder rename).
		 */
		folderPath: text("folder_path"),
		lastSyncedAt: integer("last_synced_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [
		index("images_cache_client_id_idx").on(t.clientId),
		index("images_cache_folder_id_idx").on(t.folderId),
		index("images_cache_folder_path_idx").on(t.folderPath),
		index("images_cache_uploaded_at_idx").on(t.uploadedAt),
		index("images_cache_filename_idx").on(t.filename),
	],
);

/**
 * Custom tags applied to images locally (not stored in CF). Many tags per image.
 */
export const customTags = sqliteTable(
	"custom_tags",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		imageId: text("image_id")
			.notNull()
			.references(() => imagesCache.id, { onDelete: "cascade" }),
		tag: text("tag").notNull(),
	},
	(t) => [
		index("custom_tags_image_id_idx").on(t.imageId),
		index("custom_tags_tag_idx").on(t.tag),
	],
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type ImageCacheRow = typeof imagesCache.$inferSelect;
export type NewImageCacheRow = typeof imagesCache.$inferInsert;
export type CustomTag = typeof customTags.$inferSelect;
export type NewCustomTag = typeof customTags.$inferInsert;
