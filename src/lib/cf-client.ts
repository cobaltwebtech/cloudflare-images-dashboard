import Cloudflare from "cloudflare";

/**
 * Build a Cloudflare API client. Server-only — the API token must never be
 * exposed to the browser. Always construct per-request inside server functions
 * using `getEnv().CF_API_TOKEN`.
 */
export function getCFClient(apiToken: string) {
	return new Cloudflare({ apiToken });
}
