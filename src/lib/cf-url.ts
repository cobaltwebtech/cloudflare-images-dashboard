/**
 * Cloudflare Images delivery URL helpers.
 * Format: https://imagedelivery.net/{accountHash}/{imageId}/{variantName}
 */

const BASE = "https://imagedelivery.net";

export function buildDeliveryUrl(
	hash: string,
	imageId: string,
	variant = "public",
): string {
	return `${BASE}/${hash}/${imageId}/${variant}`;
}

/**
 * Always use the `thumbnail` variant for previews. The `thumbnail` variant is
 * configured with `neverRequireSignedURLs`, so it renders even for images that
 * otherwise require a signed URL.
 */
export function pickThumbnailUrl(
	hash: string,
	imageId: string,
	_variants?: Array<string> | null,
): string {
	return buildDeliveryUrl(hash, imageId, "thumbnail");
}

export function parseVariantName(url: string): string {
	const idx = url.lastIndexOf("/");
	return idx === -1 ? url : url.slice(idx + 1);
}
