import { queryOptions } from "@tanstack/react-query";
import { getClient, listClients } from "@/server/clients";
import { getPublicConfig } from "@/server/config";
import { getFolderCounts, listFolders } from "@/server/folders";
import { getImage, listImages } from "@/server/images";
import { listSigningKeys } from "@/server/keys";
import { listVariants } from "@/server/variants";

/**
 * Centralized TanStack Query keys.
 *
 * Hierarchical structure so partial keys can be used to invalidate
 * groups of queries (e.g. `queryKeys.images.all` invalidates every
 * paginated/filtered images list as well as detail queries).
 */
export const queryKeys = {
	config: ["config"] as const,
	stats: ["stats"] as const,
	clients: {
		all: ["clients"] as const,
		detail: (id: string) => ["clients", "detail", id] as const,
	},
	folders: {
		all: ["folders"] as const,
		counts: ["folder-counts"] as const,
	},
	images: {
		all: ["images"] as const,
		list: (args: Record<string, unknown>) => ["images", args] as const,
		detail: (id: string) => ["images", "detail", id] as const,
	},
	variants: ["variants"] as const,
	signingKeys: ["signing-keys"] as const,
};

// Long staleTime for nearly-static data.
const LONG_STALE = 5 * 60_000;

/** Public CF config (account hash, has-token flag). Rarely changes. */
export const configQueryOptions = () =>
	queryOptions({
		queryKey: queryKeys.config,
		queryFn: () => getPublicConfig(),
		staleTime: LONG_STALE,
	});

export const clientsQueryOptions = () =>
	queryOptions({
		queryKey: queryKeys.clients.all,
		queryFn: () => listClients(),
		staleTime: LONG_STALE,
	});

export const clientDetailQueryOptions = (id: string) =>
	queryOptions({
		queryKey: queryKeys.clients.detail(id),
		queryFn: () => getClient({ data: { id } }),
	});

export const foldersQueryOptions = () =>
	queryOptions({
		queryKey: queryKeys.folders.all,
		queryFn: () => listFolders(),
		staleTime: LONG_STALE,
	});

export const folderCountsQueryOptions = () =>
	queryOptions({
		queryKey: queryKeys.folders.counts,
		queryFn: () => getFolderCounts(),
	});

type ImagesListArgs = {
	search?: string;
	clientId?: string | null;
	folderId?: string | null;
	limit?: number;
	offset?: number;
};

export const imagesListQueryOptions = (args: ImagesListArgs) =>
	queryOptions({
		queryKey: queryKeys.images.list(args),
		queryFn: () => listImages({ data: args }),
	});

export const imageDetailQueryOptions = (id: string) =>
	queryOptions({
		queryKey: queryKeys.images.detail(id),
		queryFn: () => getImage({ data: { id } }),
	});

export const variantsQueryOptions = () =>
	queryOptions({
		queryKey: queryKeys.variants,
		queryFn: () => listVariants(),
		staleTime: LONG_STALE,
	});

export const signingKeysQueryOptions = () =>
	queryOptions({
		queryKey: queryKeys.signingKeys,
		queryFn: () => listSigningKeys(),
		staleTime: LONG_STALE,
	});
