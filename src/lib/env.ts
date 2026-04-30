/**
 * Typed accessor for Cloudflare Worker bindings (D1, secrets, vars).
 *
 * Inside Workers, the canonical way to access bindings outside of a request
 * handler is `import { env } from "cloudflare:workers"`. `process.env` only
 * exposes string-valued vars and does NOT include non-string bindings like D1.
 *
 * Server-only — never import from client code.
 */
import { env } from "cloudflare:workers";

export function getEnv(): Cloudflare.Env {
	return env as Cloudflare.Env;
}
