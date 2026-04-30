import { getDb } from "@/db/index.ts";
import { getCFClient } from "@/lib/cf-client";
import { getEnv } from "@/lib/env";

/**
 * Build the per-request server context: typed env, Drizzle D1 client, and
 * Cloudflare API client. Call this at the top of every server function handler.
 *
 * Server-only — never import from client code.
 */
export function getServerCtx() {
	const env = getEnv();
	return {
		env,
		db: getDb(env.DB),
		cf: getCFClient(env.CF_API_TOKEN),
		accountId: env.CF_ACCOUNT_ID,
		imagesHash: env.CF_IMAGES_HASH,
	};
}

export type ServerCtx = ReturnType<typeof getServerCtx>;
