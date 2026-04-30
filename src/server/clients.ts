import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { clients, imagesCache } from "@/db/db-schema";
import { getServerCtx, type ServerCtx } from "./_ctx";

/**
 * Reusable hex color regex — `#fff` or `#ffffff`.
 */
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const ClientInputSchema = z.object({
	name: z.string().min(1).max(200),
	domain: z.string().nullish(),
	description: z.string().max(2000).nullish(),
	color: z.string().regex(HEX_COLOR).nullish(),
	creator: z.string().min(1).max(500).nullish(),
});

/**
 * Normalize a `ClientInputSchema` payload into the column values used by both
 * `createClient` (insert) and `updateClient` (update set). Any nullish field
 * is coerced to `null` so the same shape can be passed to either operation.
 */
function clientValues(data: z.infer<typeof ClientInputSchema>) {
	return {
		name: data.name,
		domain: data.domain ?? null,
		description: data.description ?? null,
		color: data.color ?? null,
		creator: data.creator?.trim() || null,
	};
}

/**
 * Backfill `images_cache.client_id` for every cached image whose CF `creator`
 * matches the given value. Used when a client's creator mapping is set or
 * changed so existing images get linked automatically.
 */
async function linkImagesByCreator(
	ctx: ServerCtx,
	clientId: string,
	creator: string | null,
) {
	if (!creator) return;
	await ctx.db
		.update(imagesCache)
		.set({ clientId })
		.where(eq(imagesCache.creator, creator));
}

/**
 * Unlink images previously auto-linked by a creator value (e.g. when a client's
 * creator mapping changes or is cleared). Clears `client_id` on every cached
 * image whose CF `creator` matches the previous value.
 */
async function unlinkImagesByPreviousCreator(
	ctx: ServerCtx,
	previousCreator: string | null,
) {
	if (!previousCreator) return;
	await ctx.db
		.update(imagesCache)
		.set({ clientId: null })
		.where(eq(imagesCache.creator, previousCreator));
}

/** Fetch a single client row by id, or `null` if missing. */
async function fetchClientById(
	db: ReturnType<typeof getServerCtx>["db"],
	id: string,
) {
	const rows = await db
		.select()
		.from(clients)
		.where(eq(clients.id, id))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * List all clients, ordered alphabetically by name.
 */
export const listClients = createServerFn({ method: "GET" }).handler(
	async () => {
		const { db } = getServerCtx();
		return db.select().from(clients).orderBy(clients.name);
	},
);

/**
 * Get a single client by id, or `null` if missing.
 */
export const getClient = createServerFn({ method: "GET" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		const { db } = getServerCtx();
		return fetchClientById(db, data.id);
	});

/**
 * Create a new client. Returns the inserted row. If `creator` is set, links
 * any existing cached images with that CF `creator` value to this client.
 */
export const createClient = createServerFn({ method: "POST" })
	.inputValidator(ClientInputSchema)
	.handler(async ({ data }) => {
		const ctx = getServerCtx();
		const { db } = ctx;
		const id = nanoid();
		const values = clientValues(data);
		await db.insert(clients).values({ id, ...values });
		await linkImagesByCreator(ctx, id, values.creator);
		const row = await fetchClientById(db, id);
		if (!row) throw new Error("Client insert failed");
		return row;
	});

/**
 * Update a client. Returns the updated row, or `null` if not found.
 *
 * If `creator` is changed, images previously linked via the old creator value
 * are cleared and images matching the new creator are linked.
 */
export const updateClient = createServerFn({ method: "POST" })
	.inputValidator(ClientInputSchema.extend({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		const ctx = getServerCtx();
		const { db } = ctx;
		const previous = await fetchClientById(db, data.id);
		const values = clientValues(data);
		await db.update(clients).set(values).where(eq(clients.id, data.id));

		const previousCreator = previous?.creator ?? null;
		if (previousCreator !== values.creator) {
			await unlinkImagesByPreviousCreator(ctx, previousCreator);
			await linkImagesByCreator(ctx, data.id, values.creator);
		}
		return fetchClientById(db, data.id);
	});

/**
 * Delete a client. Affected images have their `client_id` set to NULL by the
 * schema's ON DELETE SET NULL constraint.
 */
export const deleteClient = createServerFn({ method: "POST" })
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		const { db } = getServerCtx();
		await db.delete(clients).where(eq(clients.id, data.id));
		return { success: true };
	});
