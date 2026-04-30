import {
	ArrowsClockwiseIcon,
	GridFourIcon,
	ImageIcon,
	ListIcon,
	LockIcon,
	MagnifyingGlassIcon,
	UploadSimpleIcon,
} from "@phosphor-icons/react";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ClientPicker } from "@/components/client-picker";
import { EmptyState } from "@/components/empty-state";
import { FolderPicker } from "@/components/folder-picker";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ImageCacheRow } from "@/db/db-schema";
import { pickThumbnailUrl } from "@/lib/cf-url";
import { formatDateShort, formatNumber, parseVariants } from "@/lib/format";
import {
	clientsQueryOptions,
	configQueryOptions,
	imagesListQueryOptions,
	queryKeys,
} from "@/lib/queries";
import { syncImages } from "@/server/images";

const SearchSchema = z.object({
	q: z.string().optional(),
	clientId: z.string().nullish(),
	folderId: z.string().nullish(),
	view: z.enum(["grid", "table"]).optional(),
	page: z.number().int().min(1).optional(),
});

const PAGE_SIZE = 50;
/** Min interval between automatic background syncs (ms). */
const AUTO_SYNC_INTERVAL_MS = 60_000;
const AUTO_SYNC_STORAGE_KEY = "images:lastAutoSyncAt";

export const Route = createFileRoute("/images/")({
	component: ImagesIndex,
	validateSearch: SearchSchema,
});

/** Background sync on mount, throttled across navigations via sessionStorage. */
function useAutoSync() {
	const queryClient = useQueryClient();
	const autoSync = useMutation({
		mutationFn: () => syncImages(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.stats });
		},
	});
	const started = useRef(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		if (typeof window === "undefined") return;
		const last = Number(sessionStorage.getItem(AUTO_SYNC_STORAGE_KEY) ?? 0);
		if (Date.now() - last < AUTO_SYNC_INTERVAL_MS) return;
		sessionStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));
		autoSync.mutate();
	}, [autoSync.mutate]);
	return autoSync;
}

function SyncButton({
	onSync,
	isSyncing,
	isAutoSyncing,
}: {
	onSync: () => void;
	isSyncing: boolean;
	isAutoSyncing: boolean;
}) {
	const busy = isSyncing || isAutoSyncing;
	const label = isSyncing
		? "Syncing…"
		: isAutoSyncing
			? "Auto-syncing…"
			: "Sync from CF";
	return (
		<Button variant="outline" onClick={onSync} disabled={busy}>
			<ArrowsClockwiseIcon className={busy ? "animate-spin" : ""} />
			{label}
		</Button>
	);
}

function PagerControls({
	page,
	totalPages,
	onPageChange,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;
	const goPrev = (e: React.MouseEvent) => {
		e.preventDefault();
		if (page > 1) onPageChange(page - 1);
	};
	const goNext = (e: React.MouseEvent) => {
		e.preventDefault();
		if (page < totalPages) onPageChange(page + 1);
	};
	return (
		<Pagination className="mt-6">
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious
						href="#"
						onClick={goPrev}
						aria-disabled={page <= 1}
					/>
				</PaginationItem>
				<PaginationItem>
					<span className="px-3 text-sm text-muted-foreground">
						Page {page} of {totalPages}
					</span>
				</PaginationItem>
				<PaginationItem>
					<PaginationNext
						href="#"
						onClick={goNext}
						aria-disabled={page >= totalPages}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}

function ImagesFilters({
	searchInput,
	onSearchInputChange,
	onSubmitSearch,
	clientId,
	folderId,
	onClientChange,
	onFolderChange,
}: {
	searchInput: string;
	onSearchInputChange: (value: string) => void;
	onSubmitSearch: (e: React.SubmitEvent) => void;
	clientId: string | null | undefined;
	folderId: string | null | undefined;
	onClientChange: (id: string | null | undefined) => void;
	onFolderChange: (id: string | null | undefined) => void;
}) {
	return (
		<Card className="mb-4">
			<CardContent className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
				<form onSubmit={onSubmitSearch} className="lg:col-span-2">
					<Label htmlFor="search" className="mb-1 text-xs">
						Search
					</Label>
					<div className="relative">
						<MagnifyingGlassIcon className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
						<Input
							id="search"
							value={searchInput}
							onChange={(e) => onSearchInputChange(e.target.value)}
							placeholder="Filename or ID…"
							className="pl-8"
						/>
					</div>
				</form>

				<div>
					<Label className="mb-1 text-xs">Client</Label>
					<ClientPicker
						value={clientId}
						onChange={onClientChange}
						includeAll
						placeholder="All clients"
					/>
				</div>

				<div>
					<Label className="mb-1 text-xs">Folder</Label>
					<FolderPicker
						value={folderId}
						onChange={onFolderChange}
						includeAll
						placeholder="All folders"
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function ViewToggle({
	value,
	onChange,
}: {
	value: "grid" | "table";
	onChange: (view: "grid" | "table") => void;
}) {
	return (
		<div className="mb-3 flex items-center justify-end gap-1">
			<Button
				size="sm"
				variant={value === "grid" ? "default" : "outline"}
				onClick={() => onChange("grid")}
			>
				<GridFourIcon /> Grid
			</Button>
			<Button
				size="sm"
				variant={value === "table" ? "default" : "outline"}
				onClick={() => onChange("table")}
			>
				<ListIcon /> Table
			</Button>
		</div>
	);
}

function ImagesResults({
	isLoading,
	view,
	items,
	hash,
	clientNames,
}: {
	isLoading: boolean;
	view: "grid" | "table";
	items: Array<ImageCacheRow>;
	hash: string;
	clientNames: Record<string, string>;
}) {
	if (isLoading) {
		if (view === "grid") {
			return (
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
					{Array.from({ length: 12 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
						<Skeleton key={i} className="aspect-square rounded-md" />
					))}
				</div>
			);
		}
		return <Skeleton className="h-96 w-full" />;
	}
	if (items.length === 0) {
		return (
			<EmptyState
				icon={<ImageIcon className="size-10" />}
				title="No images match your filters"
				description="Try clearing filters or uploading a new image."
				action={
					<Button asChild>
						<Link to="/upload">
							<UploadSimpleIcon /> Upload image
						</Link>
					</Button>
				}
			/>
		);
	}
	if (view === "grid") {
		return <ImageGrid items={items} hash={hash} />;
	}
	return <ImageTable items={items} clientNames={clientNames} />;
}

// Cyclomatic count is dominated by inline JSX callbacks; cognitive complexity is 9.
// fallow-ignore-next-line complexity
function ImagesIndex() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();

	const [searchInput, setSearchInput] = useState(search.q ?? "");

	const view = search.view ?? "grid";
	const page = search.page ?? 1;
	const offset = (page - 1) * PAGE_SIZE;

	const images = useQuery({
		...imagesListQueryOptions({
			search: search.q || undefined,
			clientId: search.clientId,
			folderId: search.folderId,
			limit: PAGE_SIZE,
			offset,
		}),
		// Avoid skeletons when paginating / changing filters — show the
		// previous page's rows until the new data lands.
		placeholderData: keepPreviousData,
	});

	const config = useQuery(configQueryOptions());
	const clients = useQuery(clientsQueryOptions());

	const sync = useMutation({
		mutationFn: () => syncImages(),
		onSuccess: (data) => {
			toast.success(`Synced ${formatNumber(data.synced)} images`);
			queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.stats });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const autoSync = useAutoSync();

	const total = images.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	function update(patch: Partial<z.infer<typeof SearchSchema>>) {
		navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });
	}

	function onSubmitSearch(e: React.FormEvent) {
		e.preventDefault();
		update({ q: searchInput || undefined });
	}

	return (
		<>
			<PageHeader
				title="Images"
				description={`${formatNumber(total)} ${total === 1 ? "image" : "images"}`}
				actions={
					<>
						<SyncButton
							onSync={() => sync.mutate()}
							isSyncing={sync.isPending}
							isAutoSyncing={autoSync.isPending}
						/>
						<Button asChild>
							<Link to="/upload">
								<UploadSimpleIcon /> Upload
							</Link>
						</Button>
					</>
				}
			/>

			<ImagesFilters
				searchInput={searchInput}
				onSearchInputChange={setSearchInput}
				onSubmitSearch={onSubmitSearch}
				clientId={search.clientId}
				folderId={search.folderId}
				onClientChange={(id) => update({ clientId: id })}
				onFolderChange={(id) => update({ folderId: id })}
			/>

			<ViewToggle
				value={view}
				onChange={(v) => navigate({ search: (p) => ({ ...p, view: v }) })}
			/>

			<ImagesResults
				isLoading={images.isLoading}
				view={view}
				items={images.data?.items ?? []}
				hash={config.data?.imagesHash ?? ""}
				clientNames={Object.fromEntries(
					(clients.data ?? []).map((c) => [c.id, c.name]),
				)}
			/>

			<PagerControls
				page={page}
				totalPages={totalPages}
				onPageChange={(p) =>
					navigate({ search: (prev) => ({ ...prev, page: p }) })
				}
			/>
		</>
	);
}

function ImageGrid({
	items,
	hash,
}: {
	items: Array<ImageCacheRow>;
	hash: string;
}) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{items.map((img) => {
				const variants = parseVariants(img.variants);
				const thumb = hash ? pickThumbnailUrl(hash, img.id, variants) : "";
				return (
					<Link
						key={img.id}
						to="/images/$imageId"
						params={{ imageId: img.id }}
						className="group relative block overflow-hidden rounded-md border bg-muted"
					>
						<div className="aspect-square">
							{thumb ? (
								<img
									src={thumb}
									alt={img.filename ?? img.id}
									className="h-full w-full object-cover transition group-hover:scale-105"
									loading="lazy"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
									No preview
								</div>
							)}
						</div>
						{img.requireSignedUrls ? (
							<div
								className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
								title="Requires signed URL"
							>
								<LockIcon className="size-3.5" weight="fill" />
							</div>
						) : null}
						<div className="absolute inset-x-0 bottom-0 bg-neutral-700 p-2 text-xs text-white">
							<div className="truncate">{img.filename ?? img.id}</div>
							<div className="truncate text-white/70">
								{formatDateShort(img.uploadedAt)}
							</div>
						</div>
					</Link>
				);
			})}
		</div>
	);
}

function ImageTable({
	items,
	clientNames,
}: {
	items: Array<ImageCacheRow>;
	clientNames: Record<string, string>;
}) {
	const columns: Array<ColumnDef<ImageCacheRow>> = [
		{
			accessorKey: "filename",
			header: "Filename",
			cell: ({ row }) => (
				<Link
					to="/images/$imageId"
					params={{ imageId: row.original.id }}
					className="font-medium hover:underline"
				>
					{row.original.filename ?? row.original.id}
				</Link>
			),
		},
		{
			accessorKey: "id",
			header: "ID",
			cell: ({ row }) => (
				<code className="text-xs text-muted-foreground">{row.original.id}</code>
			),
		},
		{
			accessorKey: "folderPath",
			header: "Folder",
			cell: ({ row }) =>
				row.original.folderPath ?? (
					<span className="text-muted-foreground">/</span>
				),
		},
		{
			accessorKey: "clientId",
			header: "Client",
			cell: ({ row }) =>
				row.original.clientId ? (
					(clientNames[row.original.clientId] ?? row.original.clientId)
				) : (
					<span className="text-muted-foreground">—</span>
				),
		},
		{
			accessorKey: "requireSignedUrls",
			header: "Signed",
			cell: ({ row }) =>
				row.original.requireSignedUrls ? (
					<Badge variant="secondary" className="gap-1">
						<LockIcon className="size-3" weight="fill" /> Signed
					</Badge>
				) : null,
		},
		{
			accessorKey: "uploadedAt",
			header: "Uploaded",
			cell: ({ row }) => formatDateShort(row.original.uploadedAt),
		},
	];

	const table = useReactTable({
		data: items,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	return (
		<Card>
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((hg) => (
						<TableRow key={hg.id}>
							{hg.headers.map((h) => (
								<TableHead key={h.id}>
									{h.isPlaceholder
										? null
										: flexRender(h.column.columnDef.header, h.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow key={row.id}>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
}
