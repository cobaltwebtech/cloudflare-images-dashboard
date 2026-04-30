import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { clients, imagesCache } from "@/db/db-schema";
import { validateMeta } from "@/lib/format";
import { getServerCtx, type ServerCtx } from "./_ctx";
import { resolveFolderPath } from "./folders";

/**
 * Shape of a Cloudflare image from the API. The SDK types are loose
 * (`meta?: unknown`), so we re-narrow what we use.
 */
type CFImage = {
	id?: string;
	filename?: string;
	meta?: unknown;
	requireSignedURLs?: boolean;
	uploaded?: string;
	creator?: string | null;
	variants?: Array<string>;
};

/**
 * Convert a CF API image into an `images_cache` row insert payload.
 * Folder fields are NOT touched here — those are managed locally only.
 */
// Cyclomatic count is from per-field nullish coalesces; cognitive is 6.
// fallow-ignore-next-line complexity
function cfImageToRow(img: CFImage & { id: string }) {
	return {
		id: img.id,
		filename: img.filename ?? null,
		meta: img.meta == null ? null : JSON.stringify(img.meta),
		requireSignedUrls: img.requireSignedURLs ?? false,
		uploadedAt: img.uploaded ? new Date(img.uploaded) : null,
		creator: img.creator ?? null,
		variants: img.variants ? JSON.stringify(img.variants) : null,
		lastSyncedAt: new Date(),
	};
}

/**
 * Look up the client whose `creator` mapping matches the given CF creator
 * value. Returns the client id, or `null` when there's no match (or when
 * `creator` is empty).
 */
async function resolveClientIdByCreator(
	ctx: ServerCtx,
	creator: string | null | undefined,
): Promise<string | null> {
	if (!creator) return null;
	const rows = await ctx.db
		.select({ id: clients.id })
		.from(clients)
		.where(eq(clients.creator, creator))
		.limit(1);
	return rows[0]?.id ?? null;
}

/**
 * Upsert a single CF image into the local cache, preserving any locally-set
 * `folder_id`, `folder_path`, and `client_id`. When the CF `creator` value
 * matches a client's mapping, the image's `client_id` is set/refreshed to
 * that client (creator-mapped client wins over a previous link).
 */
async function upsertImage(ctx: ServerCtx, img: CFImage) {
	if (!img.id) return;
	const row = cfImageToRow(img as CFImage & { id: string });
	const mappedClientId = await resolveClientIdByCreator(ctx, row.creator);
	const conflictSet: Partial<typeof imagesCache.$inferInsert> = {
		filename: row.filename,
		meta: row.meta,
		requireSignedUrls: row.requireSignedUrls,
		uploadedAt: row.uploadedAt,
		creator: row.creator,
		variants: row.variants,
		lastSyncedAt: row.lastSyncedAt,
	};
	if (mappedClientId) conflictSet.clientId = mappedClientId;

	await ctx.db
		.insert(imagesCache)
		.values({ ...row, clientId: mappedClientId })
		.onConflictDoUpdate({ target: imagesCache.id, set: conflictSet });
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

const ListImagesSchema = z.object({
	search: z.string().optional(),
	clientId: z.string().nullish(),
	folderId: z.string().nullish(), // explicit string id, or `null` for root
	/** When true, recursively include images in descendant folders */
	recursive: z.boolean().optional(),
	requireSignedURLs: z.boolean().nullish(),
	limit: z.number().int().min(1).max(200).default(50),
	offset: z.number().int().min(0).default(0),
});

function isNotFoundError(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"status" in err &&
		(err as { status: number }).status === 404
	);
}

/** Fetch a cached image row by id, or throw `notFound()` if missing. */
async function fetchImageRowOrNotFound(
	db: ReturnType<typeof getServerCtx>["db"],
	id: string,
) {
	const rows = await db
		.select()
		.from(imagesCache)
		.where(eq(imagesCache.id, id))
		.limit(1);
	if (!rows[0]) throw notFound();
	return rows[0];
}

async function buildListImagesConditions(
	ctx: ServerCtx,
	data: z.infer<typeof ListImagesSchema>,
) {
	const conditions = [];

	if (data.search) {
		const term = `%${data.search}%`;
		conditions.push(
			or(like(imagesCache.filename, term), like(imagesCache.id, term)),
		);
	}

	if (data.clientId === null) {
		conditions.push(isNull(imagesCache.clientId));
	} else if (data.clientId) {
		conditions.push(eq(imagesCache.clientId, data.clientId));
	}

	if (data.folderId !== undefined) {
		conditions.push(...(await buildFolderConditions(ctx, data)));
	}

	if (data.requireSignedURLs != null) {
		conditions.push(eq(imagesCache.requireSignedUrls, data.requireSignedURLs));
	}

	return conditions;
}

async function buildFolderConditions(
	ctx: ServerCtx,
	data: z.infer<typeof ListImagesSchema>,
) {
	if (data.folderId === null) {
		return [isNull(imagesCache.folderId)];
	}
	const folderPath = await resolveFolderPath(ctx, data.folderId ?? null);
	if (data.recursive && folderPath) {
		return [
			or(
				eq(imagesCache.folderPath, folderPath),
				like(imagesCache.folderPath, `${folderPath}/%`),
			),
		];
	}
	return [eq(imagesCache.folderId, data.folderId as string)];
}

/**
 * List images from the local D1 cache with filters + pagination.
 * Use `syncImages` first if the cache might be stale.
 */
export const listImages = createServerFn({ method: "GET" })
	.inputValidator(ListImagesSchema)
	.handler(async ({ data }) => {
		const ctx = getServerCtx();
		const { db } = ctx;

		const conditions = await buildListImagesConditions(ctx, data);
		const where = conditions.length ? and(...conditions) : undefined;

		const [items, totalRow] = await Promise.all([
			db
				.select()
				.from(imagesCache)
				.where(where)
				.orderBy(desc(imagesCache.uploadedAt))
				.limit(data.limit)
				.offset(data.offset),
			db
				.select({ count: sql<number>`count(*)`.as("count") })
				.from(imagesCache)
				.where(where),
		]);

		return {
			items,
			total: totalRow[0]?.count ?? 0,
			limit: data.limit,
			offset: data.offset,
		};
	});

// ---------------------------------------------------------------------------
// GET ONE
// ---------------------------------------------------------------------------

/**
 * Fetch a single image by id. Hits CF for fresh data, refreshes the cache,
 * then returns the merged cache row (so locally-managed folder/client are
 * preserved).
 */
export const getImage = createServerFn({ method: "GET" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		const ctx = getServerCtx();
		const { cf, accountId, db } = ctx;

		let cfImage: CFImage;
		try {
			cfImage = await cf.images.v1.get(data.id, { account_id: accountId });
		} catch (err: unknown) {
			if (isNotFoundError(err)) throw notFound();
			throw err;
		}

		await upsertImage(ctx, cfImage);
		return fetchImageRowOrNotFound(db, data.id);
	});

// ---------------------------------------------------------------------------
// UPLOAD
// ---------------------------------------------------------------------------

/**
 * Upload accepts FormData with optional fields:
 *   - file (File) OR url (string)
 *   - id, creator, clientId, folderId — strings
 *   - meta — JSON string, must encode an object <= 1024 bytes
 *   - requireSignedURLs — "true" / "false"
 */
function parseUploadMeta(metaRaw: string | undefined) {
	if (!metaRaw) return undefined;
	const result = validateMeta(metaRaw);
	if (!result.ok) throw new Error(result.error);
	return result.value;
}

// Cyclomatic count is from per-field FormData reads; cognitive is low.
// fallow-ignore-next-line complexity
function parseUploadFormData(data: FormData) {
	const file = data.get("file");
	const url = data.get("url")?.toString() || undefined;
	if (!file && !url) {
		throw new Error("Provide either a `file` or a `url`");
	}

	return {
		file: file instanceof File ? file : undefined,
		url,
		id: data.get("id")?.toString() || undefined,
		creator: data.get("creator")?.toString() || undefined,
		clientId: data.get("clientId")?.toString() || undefined,
		folderId: data.get("folderId")?.toString() || undefined,
		meta: parseUploadMeta(data.get("meta")?.toString()),
		requireSignedURLs: data.get("requireSignedURLs")?.toString() === "true",
	};
}

export const uploadImage = createServerFn({ method: "POST" })
	.inputValidator((data) => {
		if (!(data instanceof FormData)) throw new Error("Expected FormData");
		return parseUploadFormData(data);
	})
	.handler(async ({ data }) => {
		const ctx = getServerCtx();
		const { cf, accountId, db } = ctx;

		const cfImage = await cf.images.v1.create({
			account_id: accountId,
			file: data.file,
			url: data.url,
			id: data.id,
			creator: data.creator,
			metadata: data.meta,
			requireSignedURLs: data.requireSignedURLs,
		});

		const newId = cfImage.id;
		if (!newId) throw new Error("Upload succeeded but no image ID returned");

		const folderPath = await resolveFolderPath(ctx, data.folderId ?? null);

		// Insert with our local-only metadata applied. If no explicit clientId was
		// provided, fall back to the client whose `creator` mapping matches.
		const row = cfImageToRow({ ...cfImage, id: newId });
		const clientId =
			data.clientId ?? (await resolveClientIdByCreator(ctx, row.creator));
		await db.insert(imagesCache).values({
			...row,
			clientId,
			folderId: data.folderId ?? null,
			folderPath,
		});

		const rows = await db
			.select()
			.from(imagesCache)
			.where(eq(imagesCache.id, newId))
			.limit(1);
		if (!rows[0]) throw new Error("Image upload cache insert failed");
		return rows[0];
	});

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

const UpdateImageSchema = z.object({
	id: z.string().min(1),
	// CF-side fields
	meta: z.record(z.string(), z.unknown()).optional(),
	requireSignedURLs: z.boolean().optional(),
	creator: z.string().nullish(),
	// Local-only fields
	clientId: z.string().nullable().optional(),
	folderId: z.string().nullable().optional(),
});

async function applyCFUpdate(
	ctx: ServerCtx,
	data: z.infer<typeof UpdateImageSchema>,
) {
	if (data.meta) {
		const bytes = new TextEncoder().encode(JSON.stringify(data.meta)).length;
		if (bytes > 1024) {
			throw new Error("`meta` exceeds the 1024-byte CF limit");
		}
	}
	const cfImage = await ctx.cf.images.v1.edit(data.id, {
		account_id: ctx.accountId,
		metadata: data.meta,
		requireSignedURLs: data.requireSignedURLs,
		creator: data.creator ?? undefined,
	});
	await upsertImage(ctx, cfImage);
}

async function applyLocalUpdate(
	ctx: ServerCtx,
	data: z.infer<typeof UpdateImageSchema>,
) {
	const localUpdate: Partial<typeof imagesCache.$inferInsert> = {};
	if (data.clientId !== undefined) localUpdate.clientId = data.clientId;
	if (data.folderId !== undefined) {
		localUpdate.folderId = data.folderId;
		localUpdate.folderPath = await resolveFolderPath(ctx, data.folderId);
	}
	if (Object.keys(localUpdate).length) {
		await ctx.db
			.update(imagesCache)
			.set(localUpdate)
			.where(eq(imagesCache.id, data.id));
	}
}

/**
 * Update an image. Splits CF-managed fields (meta/signed/creator) from
 * locally-managed fields (clientId/folderId). Either or both may be omitted.
 */
export const updateImage = createServerFn({ method: "POST" })
	.inputValidator(UpdateImageSchema)
	.handler(async ({ data }) => {
		const ctx = getServerCtx();

		const hasCFChange =
			data.meta !== undefined ||
			data.requireSignedURLs !== undefined ||
			data.creator !== undefined;

		if (hasCFChange) await applyCFUpdate(ctx, data);
		await applyLocalUpdate(ctx, data);

		return fetchImageRowOrNotFound(ctx.db, data.id);
	});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Delete an image from CF and remove it from the local cache.
 */
export const deleteImage = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		const ctx = getServerCtx();
		const { cf, accountId, db } = ctx;

		await cf.images.v1.delete(data.id, { account_id: accountId });
		await db.delete(imagesCache).where(eq(imagesCache.id, data.id));
		return { success: true };
	});

// ---------------------------------------------------------------------------
// SYNC
// ---------------------------------------------------------------------------

/**
 * Bulk-paginate every image from CF V2 list and upsert into the local cache.
 * Preserves locally-managed `client_id` / `folder_id` / `folder_path` (the
 * upsert only touches CF-sourced columns).
 *
 * Returns the number of images synced. Long-running for large libraries — call
 * sparingly; for incremental updates rely on per-action upserts.
 */
export const syncImages = createServerFn({ method: "POST" }).handler(
	async () => {
		const ctx = getServerCtx();
		const { cf, accountId } = ctx;

		let total = 0;
		let continuationToken: string | undefined;

		// Manually paginate V2 list via continuation_token. The SDK returns the
		// raw response shape for V2 rather than an async-iterable pager.
		do {
			const page = await cf.images.v2.list({
				account_id: accountId,
				per_page: 1000,
				...(continuationToken ? { continuation_token: continuationToken } : {}),
			});
			for (const img of page.images ?? []) {
				await upsertImage(ctx, img as CFImage);
				total++;
			}
			continuationToken = page.continuation_token ?? undefined;
		} while (continuationToken);

		return { synced: total };
	},
);
