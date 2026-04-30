import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db-schema.ts";

/**
 * Build a Drizzle D1 client bound to the Workers `DB` binding.
 * Always pass the per-request `env` from `getEnv()` rather than caching globally —
 * Workers reuse the isolate but bindings come from the request context.
 */
export function getDb(d1: D1Database) {
	return drizzle(d1, { schema });
}
