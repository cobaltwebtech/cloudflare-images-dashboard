/**
 * Utility functions for formatting and validating data across the application.
 * Includes helpers for file sizes, numbers, dates, Cloudflare Images metadata,
 * and variant parsing.
 */

/**
 * Formats a byte count into a human-readable string with appropriate units.
 *
 * Converts raw bytes (e.g., `1048576`) into a formatted string
 * (e.g., `"1.0 MB"`). Uses binary units (base 1024) and rounds to
 * the specified number of decimal places.
 *
 * @param bytes - The number of bytes to format.
 * @param decimals - Number of decimal places (default: `1`).
 * @returns A human-readable string like `"1.5 KB"`, `"3.2 GB"`.
 *
 * @example
 * ```ts
 * formatBytes(1024)        // "1.0 KB"
 * formatBytes(1_572_864)   // "1.5 MB"
 * formatBytes(512, 0)      // "512 B"
 * ```
 */
export function formatBytes(bytes: number, decimals = 1): string {
	if (!bytes) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(
		Math.floor(Math.log(bytes) / Math.log(k)),
		sizes.length - 1,
	);
	return `${(bytes / k ** i).toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Formats a number with locale-aware digit grouping.
 *
 * Uses `Intl.NumberFormat` (US English) to add thousands separators,
 * making large numbers easier to read.
 *
 * @param n - The number to format.
 * @returns A formatted string with grouping separators.
 *
 * @example
 * ```ts
 * formatNumber(1000)       // "1,000"
 * formatNumber(1234567)    // "1,234,567"
 * ```
 */
export function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

/**
 * Formats a date/time value into a human-readable string with both
 * date and time components.
 *
 * Accepts `Date`, ISO strings, Unix timestamps (ms), or `null`/`undefined`.
 * Invalid dates render as `"—"`. Uses the "medium" date style and
 * "short" time style (e.g., `"May 19, 2026, 3:45 PM"`).
 * Output is locale-aware (US English) and adjusts for the user's timezone.
 *
 * @param d - The date value to format.
 * @returns A formatted datetime string, or `"—"` if `d` is nullish/invalid.
 *
 * @example
 * ```ts
 * formatDate(new Date())              // "May 19, 2026, 3:45 PM"
 * formatDate("2026-05-19T15:45:00Z")  // "May 19, 2026, 3:45 PM"
 * formatDate(null)                    // "—"
 * ```
 */
export function formatDate(
	d: Date | string | number | null | undefined,
): string {
	return formatWithIntl(d, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Formats a date value into a human-readable string with only the date component.
 *
 * Like {@link formatDate} but omits the time portion, using "medium" date style only
 * (e.g., `"May 19, 2026"`). Accepts the same input types and returns `"—"` for
 * nullish/invalid values.
 *
 * @param d - The date value to format.
 * @returns A formatted date string, or `"—"` if `d` is nullish/invalid.
 *
 * @example
 * ```ts
 * formatDateShort(new Date())              // "May 19, 2026"
 * formatDateShort("2026-05-19T15:45:00Z")  // "May 19, 2026"
 * ```
 */
export function formatDateShort(
	d: Date | string | number | null | undefined,
): string {
	return formatWithIntl(d, { dateStyle: "medium" });
}

/**
 * Internal helper that normalizes various date inputs into a single
 * `Intl.DateTimeFormat` call. Returns `"—"` for nullish or invalid dates.
 */
function formatWithIntl(
	d: Date | string | number | null | undefined,
	options: Intl.DateTimeFormatOptions,
): string {
	if (!d) return "—";
	const date = d instanceof Date ? d : new Date(d);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", options).format(date);
}

/**
 * Result shape for {@link validateMeta}: a discriminated union indicating
 * either successful validation with the parsed object, or a failure with
 * a user-facing error message.
 */
type ValidateMetaResult =
	| { ok: true; value: Record<string, unknown> }
	| { ok: false; error: string };

/**
 * Validates a JSON metadata string for use with Cloudflare Images.
 *
 * Returns `{ ok: true, value }` when the string is empty or contains valid JSON
 * representing a plain object within the byte limit. Returns `{ ok: false, error }`
 * for malformed JSON, non-object types, or oversized payloads.
 *
 * Each failure branch produces a distinct user-facing error message so callers can
 * surface specific feedback.
 *
 * @param meta - The raw JSON metadata string to validate.
 * @param maxBytes - Maximum allowed byte size (default: `1024`).
 * @returns A {@link ValidateMetaResult} discriminated union.
 *
 * @example
 * ```ts
 * const result = validateMeta('{"tag": "photo"}');
 * if (result.ok) { handleValue(result.value); } else { handleError(result.error); }
 * ```
 */
// Validator with multiple failure modes; each branch produces a distinct
// user-facing error. Cognitive complexity is 7.
// fallow-ignore-next-line complexity
export function validateMeta(
	meta: string,
	maxBytes = 1024,
): ValidateMetaResult {
	if (!meta.trim()) return { ok: true, value: {} };
	try {
		const parsed = JSON.parse(meta);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { ok: false, error: "Metadata must be a JSON object" };
		}
		const bytes = new TextEncoder().encode(meta).length;
		if (bytes > maxBytes) {
			return {
				ok: false,
				error: `Metadata is ${bytes} bytes; max ${maxBytes}.`,
			};
		}
		return { ok: true, value: parsed as Record<string, unknown> };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Invalid JSON",
		};
	}
}

/**
 * Parses a variants string (typically JSON-encoded array) into a flat list of variant names.
 *
 * Safely handles nullish input and malformed JSON by returning an empty array.
 * Only string elements are included; non-string entries are filtered out.
 *
 * @param variants - A JSON string like `'["thumbnail", "original"]'`, or `null`/`undefined`.
 * @returns An array of variant name strings, or `[]` if input is empty/invalid.
 *
 * @example
 * ```ts
 * parseVariants('["thumb", "full"]')   // ["thumb", "full"]
 * parseVariants(null)                  // []
 * parseVariants('not json')            // []
 * ```
 */
export function parseVariants(
	variants: string | null | undefined,
): Array<string> {
	if (!variants) return [];
	try {
		const parsed = JSON.parse(variants);
		return Array.isArray(parsed)
			? parsed.filter((v) => typeof v === "string")
			: [];
	} catch {
		return [];
	}
}
