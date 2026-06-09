import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerCtx } from "./_ctx";

/**
 * List all signing keys for Cloudflare Images. Used to mint signed URLs for
 * private images.
 */
export const listSigningKeys = createServerFn({ method: "GET" }).handler(
	async () => {
		const { cf, accountId } = getServerCtx();
		const res = await cf.images.v1.keys.list({ account_id: accountId });
		return res.keys ?? [];
	},
);

const KeyNameSchema = z.object({
	name: z
		.string()
		.min(1)
		.max(20)
		.regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, dashes, underscores only"),
});

/**
 * Create a new signing key. CF generates the value; the name is user-supplied.
 * Returns the full updated list of keys.
 *
 * NOTE: We strip both the SDK's `api-version` and `Content-Type` headers on
 * this call. Cloudflare's edge mis-routes signing-key PUTs that carry either
 * header into the image-upload pipeline, returning a misleading 5415 ("Must
 * be uploaded as a form...") error. Verified independently with curl: a bare
 * PUT succeeds; adding either header alone reproduces the 5415. The SDK's
 * `applyHeadersMut` deletes any header whose value is `null`.
 */
export const createSigningKey = createServerFn({ method: "POST" })
	.validator(KeyNameSchema)
	.handler(async ({ data }) => {
		const { cf, accountId } = getServerCtx();
		const res = await cf.images.v1.keys.update(data.name, {
			account_id: accountId,
		});
		return res.keys ?? [];
	});

/**
 * Delete a signing key. When the last key is removed CF auto-generates a new
 * default. Returns the remaining keys.
 */
export const deleteSigningKey = createServerFn({ method: "POST" })
	.validator(KeyNameSchema)
	.handler(async ({ data }) => {
		const { cf, accountId } = getServerCtx();
		const res = await cf.images.v1.keys.delete(data.name, {
			account_id: accountId,
		});
		return res.keys ?? [];
	});
