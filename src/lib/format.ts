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

export function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(
	d: Date | string | number | null | undefined,
): string {
	return formatWithIntl(d, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateShort(
	d: Date | string | number | null | undefined,
): string {
	return formatWithIntl(d, { dateStyle: "medium" });
}

function formatWithIntl(
	d: Date | string | number | null | undefined,
	options: Intl.DateTimeFormatOptions,
): string {
	if (!d) return "—";
	const date = d instanceof Date ? d : new Date(d);
	if (Number.isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("en-US", options).format(date);
}

type ValidateMetaResult =
	| { ok: true; value: Record<string, unknown> }
	| { ok: false; error: string };

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
