import { createServerFn } from "@tanstack/react-start";
import { getServerCtx } from "./_ctx";

/**
 * Public, non-secret config the client needs to render image URLs.
 * Safe to expose — the images hash is part of every imagedelivery.net URL.
 */
export const getPublicConfig = createServerFn({ method: "GET" }).handler(
	async () => {
		const { imagesHash, accountId } = getServerCtx();
		return { imagesHash, accountId };
	},
);
