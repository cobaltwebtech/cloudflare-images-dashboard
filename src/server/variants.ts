import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getServerCtx } from "./_ctx";

type CfVariantOptions = {
	fit: "scale-down" | "contain" | "cover" | "crop" | "pad";
	width: number;
	height: number;
	metadata: "keep" | "copyright" | "none";
};

/** Build the options payload omitting undefined width/height entirely. */
function buildOptions(opts: {
	fit: CfVariantOptions["fit"];
	width?: number;
	height?: number;
	metadata: CfVariantOptions["metadata"];
}): CfVariantOptions {
	const out: Record<string, unknown> = {
		fit: opts.fit,
		metadata: opts.metadata,
	};
	if (opts.width != null) out.width = opts.width;
	if (opts.height != null) out.height = opts.height;
	return out as CfVariantOptions;
}

/**
 * List all image variants (resize/crop presets).
 */
export const listVariants = createServerFn({ method: "GET" }).handler(
	async () => {
		const { cf, accountId } = getServerCtx();
		const res = await cf.images.v1.variants.list({ account_id: accountId });
		return res.variants ?? {};
	},
);

const VariantOptionsSchema = z
	.object({
		fit: z.enum(["scale-down", "contain", "cover", "crop", "pad"]),
		width: z.number().int().positive().optional(),
		height: z.number().int().positive().optional(),
		metadata: z.enum(["keep", "copyright", "none"]),
	})
	.refine((opts) => opts.width != null || opts.height != null, {
		message: "At least one of `width` or `height` is required",
		path: ["width"],
	});

const VariantInputSchema = z.object({
	id: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-zA-Z0-9_-]+$/),
	options: VariantOptionsSchema,
	neverRequireSignedURLs: z.boolean().optional(),
});

/**
 * Create a new variant. The variant `id` becomes the URL segment
 * (`imagedelivery.net/{hash}/{imageId}/{variantId}`).
 */
export const createVariant = createServerFn({ method: "POST" })
	.validator(VariantInputSchema)
	.handler(async ({ data }) => {
		const { cf, accountId } = getServerCtx();
		const res = await cf.images.v1.variants.create({
			account_id: accountId,
			id: data.id,
			options: buildOptions(data.options),
			neverRequireSignedURLs: data.neverRequireSignedURLs,
		});
		return res.variant;
	});

const VariantUpdateSchema = z.object({
	id: z.string().min(1),
	options: VariantOptionsSchema,
	neverRequireSignedURLs: z.boolean().optional(),
});

/**
 * Update a variant. Purges cache for all images using this variant.
 */
export const updateVariant = createServerFn({ method: "POST" })
	.validator(VariantUpdateSchema)
	.handler(async ({ data }) => {
		const { cf, accountId } = getServerCtx();
		const res = await cf.images.v1.variants.edit(data.id, {
			account_id: accountId,
			options: buildOptions(data.options),
			neverRequireSignedURLs: data.neverRequireSignedURLs,
		});
		return res.variant;
	});

/**
 * Delete a variant. Purges cache for all images using this variant.
 */
export const deleteVariant = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		const { cf, accountId } = getServerCtx();
		await cf.images.v1.variants.delete(data.id, { account_id: accountId });
		return { success: true };
	});
