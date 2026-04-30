import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { folders, imagesCache } from "@/db/db-schema";
import { getServerCtx } from "./_ctx";

/**
 * Folder name segment validation: no slashes, no leading/trailing whitespace,
 * not empty, max 100 chars.
 */
const FolderNameSchema = z
	.string()
	.min(1)
	.max(100)
	.regex(/^[^/]+$/, 'Folder name cannot contain "/"')
	.refine((s) => s === s.trim(), "No leading/trailing whitespace");

/**
 * Build the canonical full path for a folder given its parent path + name.
 * Always starts with `/`. Root parent is represented by `null`.
 */
function buildPath(parentPath: string | null, name: string): string {
	return parentPath ? `${parentPath}/${name}` : `/${name}`;
}

/**
 * Fetch a single folder row by id or throw `notFound()`. Used by the rename,
 * move, and delete handlers, which all need the current row before mutating.
 */
async function getFolderById(
	db: ReturnType<typeof getServerCtx>["db"],
	id: string,
) {
	const rows = await db
		.select()
		.from(folders)
		.where(eq(folders.id, id))
		.limit(1);
	if (!rows[0]) throw notFound();
	return rows[0];
}

/**
 * Resolve the new parent path for a move, validating that the target exists
 * and is not the folder itself or one of its descendants. Returns null when
 * moving to root.
 */
async function resolveMoveTargetPath(
	db: ReturnType<typeof getServerCtx>["db"],
	folder: { path: string },
	newParentId: string | null,
): Promise<string | null> {
	if (!newParentId) return null;
	const parent = await db
		.select()
		.from(folders)
		.where(eq(folders.id, newParentId))
		.limit(1);
	if (!parent[0]) throw notFound();
	if (
		parent[0].path === folder.path ||
		parent[0].path.startsWith(`${folder.path}/`)
	) {
		throw new Error("Cannot move a folder into one of its descendants");
	}
	return parent[0].path;
}

/**
 * Run a D1 batch and return the freshly-loaded folder row, or `notFound()` if
 * it disappeared. Shared between `renameFolder` and `moveFolder`.
 */
async function batchAndReloadFolder(
	ctx: ReturnType<typeof getServerCtx>,
	folderId: string,
	stmts: Array<ReturnType<D1Database["prepare"]>>,
) {
	await ctx.env.DB.batch(stmts);
	const rows = await ctx.db
		.select()
		.from(folders)
		.where(eq(folders.id, folderId))
		.limit(1);
	if (!rows[0]) throw notFound();
	return rows[0];
}

/**
 * Build the 3 D1 statements shared by `renameFolder` and `moveFolder` to
 * cascade a folder path change: re-prefix descendant folders, update images
 * directly under the folder, and re-prefix images under descendant folders.
 *
 * The caller is responsible for prepending its own UPDATE for the root row
 * (which differs between rename and move).
 */
function buildPathCascadeStatements(
	env: ReturnType<typeof getServerCtx>["env"],
	oldPath: string,
	newPath: string,
) {
	const oldPrefix = `${oldPath}/`;
	const newPrefix = `${newPath}/`;
	const oldLen = oldPath.length;
	return [
		// Re-prefix descendant folders' paths
		env.DB.prepare(
			"UPDATE folders SET path = ? || SUBSTR(path, ? + 1) WHERE path LIKE ?",
		).bind(newPrefix, oldLen, `${oldPrefix}%`),
		// Update images in this exact folder
		env.DB.prepare(
			"UPDATE images_cache SET folder_path = ? WHERE folder_path = ?",
		).bind(newPath, oldPath),
		// Re-prefix images in descendant folders
		env.DB.prepare(
			"UPDATE images_cache SET folder_path = ? || SUBSTR(folder_path, ? + 1) WHERE folder_path LIKE ?",
		).bind(newPrefix, oldLen, `${oldPrefix}%`),
	];
}

/**
 * List all folders, ordered by path so consumers can build a tree client-side
 * via parent/path relationships.
 */
export const listFolders = createServerFn({ method: "GET" }).handler(
	async () => {
		const { db } = getServerCtx();
		return db.select().from(folders).orderBy(folders.path);
	},
);

const CreateFolderSchema = z.object({
	name: FolderNameSchema,
	parentId: z.string().min(1).nullable(),
});

/**
 * Create a folder under the given parent (or at root if `parentId` is null).
 * Fails if a sibling with the same name already exists (unique path index).
 */
export const createFolder = createServerFn({ method: "POST" })
	.inputValidator(CreateFolderSchema)
	.handler(async ({ data }) => {
		const { db } = getServerCtx();

		let parentPath: string | null = null;
		if (data.parentId) {
			const parent = await db
				.select()
				.from(folders)
				.where(eq(folders.id, data.parentId))
				.limit(1);
			if (!parent[0]) throw notFound();
			parentPath = parent[0].path;
		}

		const id = nanoid();
		const path = buildPath(parentPath, data.name);

		await db.insert(folders).values({
			id,
			name: data.name,
			parentId: data.parentId,
			path,
		});

		const rows = await db
			.select()
			.from(folders)
			.where(eq(folders.id, id))
			.limit(1);
		if (!rows[0]) throw new Error("Folder insert failed");
		return rows[0];
	});

const RenameFolderSchema = z.object({
	id: z.string().min(1),
	name: FolderNameSchema,
});

/**
 * Rename a folder. Updates the folder's `path` and cascades the prefix change
 * to all descendant folders and to the `folder_path` of all images under any
 * affected folder. Executed in a single D1 batch for atomicity.
 */
export const renameFolder = createServerFn({ method: "POST" })
	.inputValidator(RenameFolderSchema)
	.handler(async ({ data }) => {
		const { env, db } = getServerCtx();

		const folder = await getFolderById(db, data.id);
		if (folder.name === data.name) return folder;

		const parentPath = folder.parentId
			? folder.path.slice(0, folder.path.lastIndexOf("/")) || null
			: null;
		const newPath = buildPath(parentPath, data.name);
		if (newPath === folder.path) return folder;

		// Build raw D1 statements so we can ship one atomic batch via env.DB.batch.
		const stmts = [
			// Update this folder's name + path
			env.DB.prepare("UPDATE folders SET name = ?, path = ? WHERE id = ?").bind(
				data.name,
				newPath,
				folder.id,
			),
			...buildPathCascadeStatements(env, folder.path, newPath),
		];

		return batchAndReloadFolder(getServerCtx(), folder.id, stmts);
	});

const MoveFolderSchema = z.object({
	id: z.string().min(1),
	newParentId: z.string().min(1).nullable(),
});

/**
 * Move a folder under a new parent (or to root if `newParentId` is null).
 * Cascades path updates to all descendants and affected images. Prevents
 * moving a folder into itself or one of its descendants.
 */
export const moveFolder = createServerFn({ method: "POST" })
	.inputValidator(MoveFolderSchema)
	.handler(async ({ data }) => {
		const { env, db } = getServerCtx();

		const folder = await getFolderById(db, data.id);
		if (data.newParentId === folder.id) {
			throw new Error("Cannot move a folder into itself");
		}

		const newParentPath = await resolveMoveTargetPath(
			db,
			folder,
			data.newParentId,
		);

		const newPath = buildPath(newParentPath, folder.name);
		if (newPath === folder.path && data.newParentId === folder.parentId) {
			return folder;
		}

		const stmts = [
			env.DB.prepare(
				"UPDATE folders SET parent_id = ?, path = ? WHERE id = ?",
			).bind(data.newParentId, newPath, folder.id),
			...buildPathCascadeStatements(env, folder.path, newPath),
		];

		return batchAndReloadFolder(getServerCtx(), folder.id, stmts);
	});

/**
 * Delete a folder and all descendant folders. Affected images have their
 * `folder_id` set to NULL (moved to root) via ON DELETE SET NULL; we also
 * clear `folder_path` to keep it consistent with `folder_id`.
 *
 * Note: images do NOT cascade-delete with folders — only the folder rows do.
 */
export const deleteFolder = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		const { env, db } = getServerCtx();

		const folder = await getFolderById(db, data.id);

		const subPattern = `${folder.path}/%`;

		const stmts = [
			// Null out folder_id + folder_path together on every image under this
			// folder or its descendants. Both columns must move in lockstep to
			// satisfy the `images_cache_folder_consistency` CHECK constraint —
			// the FK ON DELETE SET NULL alone would null folder_id later, but
			// this UPDATE runs first and would otherwise violate the check.
			env.DB.prepare(
				"UPDATE images_cache SET folder_id = NULL, folder_path = NULL WHERE folder_path = ? OR folder_path LIKE ?",
			).bind(folder.path, subPattern),
			// Delete this folder; descendants cascade via folders.parent_id FK
			env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(folder.id),
		];

		await env.DB.batch(stmts);
		return { success: true };
	});

/**
 * Counts of immediate (non-recursive) child folders and images per folder path.
 * Used by the folder browser sidebar.
 *
 * Returns a flat list keyed by `path` so the client can decorate the tree.
 */
export const getFolderCounts = createServerFn({ method: "GET" }).handler(
	async () => {
		const { db } = getServerCtx();

		const folderCounts = await db
			.select({
				parentId: folders.parentId,
				count: sql<number>`count(*)`.as("count"),
			})
			.from(folders)
			.groupBy(folders.parentId);

		const imageCounts = await db
			.select({
				folderId: imagesCache.folderId,
				count: sql<number>`count(*)`.as("count"),
			})
			.from(imagesCache)
			.groupBy(imagesCache.folderId);

		return { folderCounts, imageCounts };
	},
);

/**
 * Helper used by image server functions: resolve a folder id to its path,
 * or return `null` for root. Throws notFound if id is set but missing.
 */
export async function resolveFolderPath(
	ctx: ReturnType<typeof getServerCtx>,
	folderId: string | null,
): Promise<string | null> {
	if (!folderId) return null;
	const rows = await ctx.db
		.select({ path: folders.path })
		.from(folders)
		.where(eq(folders.id, folderId))
		.limit(1);
	if (!rows[0]) throw notFound();
	return rows[0].path;
}
