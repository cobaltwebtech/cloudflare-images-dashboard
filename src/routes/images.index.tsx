import {
	ArrowsClockwiseIcon,
	FolderPlusIcon,
	FolderSimpleIcon,
	GridFourIcon,
	ImageIcon,
	ListIcon,
	LockIcon,
	MagnifyingGlassIcon,
	UploadSimpleIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { BulkEdit } from "@/components/bulk-edit";
import { ClientPicker } from "@/components/client-picker";
import { EmptyState } from "@/components/empty-state";
import { FolderTreeFilter } from "@/components/folder-tree-filter";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
const AUTO_SYNC_INTERVAL_MS = 30 * 60_000;
const AUTO_SYNC_STORAGE_KEY = "images:lastAutoSyncAt";
const VIEW_STORAGE_KEY = "images:view";
const DEFAULT_VIEW: "grid" | "table" = "table";

function readStoredView(): "grid" | "table" {
	if (typeof window === "undefined") return DEFAULT_VIEW;
	const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
	return v === "grid" || v === "table" ? v : DEFAULT_VIEW;
}

export const Route = createFileRoute("/images/")({
	component: ImagesIndex,
	validateSearch: SearchSchema,
});

/**
 * Background sync on mount, throttled across navigations and tabs via
 * localStorage. Marks image lists stale without forcing an immediate refetch
 * — the next render or interaction will pull the fresh data.
 */
function useAutoSync() {
	const queryClient = useQueryClient();
	const autoSync = useMutation({
		mutationFn: () => syncImages(),
		onSuccess: () => {
			// Mark stale only — don't refetch every cached list right now.
			queryClient.invalidateQueries({
				queryKey: queryKeys.images.all,
				refetchType: "none",
			});
			queryClient.invalidateQueries({
				queryKey: queryKeys.stats,
				refetchType: "none",
			});
		},
	});
	const started = useRef(false);
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		if (typeof window === "undefined") return;
		const last = Number(localStorage.getItem(AUTO_SYNC_STORAGE_KEY) ?? 0);
		if (Date.now() - last < AUTO_SYNC_INTERVAL_MS) return;
		localStorage.setItem(AUTO_SYNC_STORAGE_KEY, String(Date.now()));
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
	onClientChange,
	hasActiveFilters,
	onClearFilters,
}: {
	searchInput: string;
	onSearchInputChange: (value: string) => void;
	onSubmitSearch: (e: React.SubmitEvent) => void;
	clientId: string | null | undefined;
	onClientChange: (id: string | null | undefined) => void;
	hasActiveFilters: boolean;
	onClearFilters: () => void;
}) {
	return (
		<Card className="mb-4">
			<CardHeader>
				<CardTitle>Search & Filter</CardTitle>
				{hasActiveFilters ? (
					<CardAction>
						<Button variant="ghost" size="sm" onClick={onClearFilters}>
							<XIcon /> Clear filters
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent className="flex items-center gap-4 lg:gap-6">
				<form onSubmit={onSubmitSearch} className="flex-1">
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

				<div className="min-w-80">
					<Label className="mb-1 text-xs">Client</Label>
					<ClientPicker
						value={clientId}
						onChange={onClientChange}
						includeAll
						placeholder="All clients"
						className="w-full"
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
		<div className="mb-3 flex items-center justify-start gap-1">
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
	selected,
	onToggleOne,
	onToggleAll,
}: {
	isLoading: boolean;
	view: "grid" | "table";
	items: Array<ImageCacheRow>;
	hash: string;
	clientNames: Record<string, string>;
	selected: Set<string>;
	onToggleOne: (id: string, checked: boolean) => void;
	onToggleAll: (checked: boolean) => void;
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
		return (
			<ImageGrid
				items={items}
				hash={hash}
				selected={selected}
				onToggleOne={onToggleOne}
			/>
		);
	}
	return (
		<ImageTable
			items={items}
			clientNames={clientNames}
			selected={selected}
			onToggleOne={onToggleOne}
			onToggleAll={onToggleAll}
		/>
	);
}

// Cyclomatic count is dominated by inline JSX callbacks; cognitive complexity is 9.
// fallow-ignore-next-line complexity
function ImagesIndex() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();

	const [searchInput, setSearchInput] = useState(search.q ?? "");
	// Bulk-selected image IDs. Persists across pagination/filter changes so the
	// user can build a multi-page selection before applying a bulk action.
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [bulkOpen, setBulkOpen] = useState(false);

	const view = search.view ?? readStoredView();
	const page = search.page ?? 1;
	const offset = (page - 1) * PAGE_SIZE;

	const images = useQuery(
		imagesListQueryOptions({
			search: search.q || undefined,
			clientId: search.clientId,
			folderId: search.folderId,
			limit: PAGE_SIZE,
			offset,
		}),
	);

	const config = useQuery(configQueryOptions());
	const clients = useQuery(clientsQueryOptions());

	const sync = useMutation({
		mutationFn: () => syncImages(),
		onSuccess: (data) => {
			toast.success(
				`Synced ${formatNumber(data.synced)} images (${formatNumber(data.written)} updated)`,
			);
			queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.stats });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const autoSync = useAutoSync();

	const total = images.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const pageItems = images.data?.items ?? [];

	function toggleOne(id: string, checked: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}

	function toggleAllOnPage(checked: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			for (const it of pageItems) {
				if (checked) next.add(it.id);
				else next.delete(it.id);
			}
			return next;
		});
	}

	function clearSelection() {
		setSelected(new Set());
	}

	function update(patch: Partial<z.infer<typeof SearchSchema>>) {
		navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });
	}

	function onSubmitSearch(e: React.FormEvent) {
		e.preventDefault();
		update({ q: searchInput || undefined });
	}

	const hasActiveFilters = Boolean(
		search.q || search.clientId || search.folderId,
	);

	function clearFilters() {
		setSearchInput("");
		navigate({
			search: (prev) => ({
				...prev,
				q: undefined,
				clientId: undefined,
				folderId: undefined,
				page: 1,
			}),
		});
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

			{/* Two-column flex layout: main results on the left, folder
			    sidebar on the right. Stacks on small screens; side-by-side at lg. */}
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
				<div className="flex min-w-0 flex-1 flex-col">
					<ImagesFilters
						searchInput={searchInput}
						onSearchInputChange={setSearchInput}
						onSubmitSearch={onSubmitSearch}
						clientId={search.clientId}
						onClientChange={(id) => update({ clientId: id })}
						hasActiveFilters={hasActiveFilters}
						onClearFilters={clearFilters}
					/>

					<ViewToggle
						value={view}
						onChange={(v) => {
							if (typeof window !== "undefined") {
								window.localStorage.setItem(VIEW_STORAGE_KEY, v);
							}
							navigate({ search: (p) => ({ ...p, view: v }) });
						}}
					/>

					{selected.size > 0 ? (
						<div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
							<div className="font-medium">
								{formatNumber(selected.size)} selected
							</div>
							<div className="flex items-center gap-2">
								<Button size="sm" onClick={() => setBulkOpen(true)}>
									<FolderSimpleIcon /> Bulk edit
								</Button>
								<Button size="sm" variant="ghost" onClick={clearSelection}>
									<XIcon /> Clear
								</Button>
							</div>
						</div>
					) : null}

					<ImagesResults
						isLoading={images.isLoading}
						view={view}
						items={pageItems}
						hash={config.data?.imagesHash ?? ""}
						clientNames={Object.fromEntries(
							(clients.data ?? []).map((c) => [c.id, c.name]),
						)}
						selected={selected}
						onToggleOne={toggleOne}
						onToggleAll={toggleAllOnPage}
					/>

					<PagerControls
						page={page}
						totalPages={totalPages}
						onPageChange={(p) =>
							navigate({ search: (prev) => ({ ...prev, page: p }) })
						}
					/>
				</div>

				<aside
					aria-label="Folders"
					className="w-full shrink-0 lg:sticky lg:top-4 lg:w-65"
				>
					<Card>
						<CardHeader>
							<CardTitle>Folders</CardTitle>
							<CardAction>
								<Button asChild>
									<Link to="/folders">
										<FolderPlusIcon />
									</Link>
								</Button>
							</CardAction>
						</CardHeader>
						<CardContent>
							<div className="max-h-[60vh] overflow-y-auto">
								<FolderTreeFilter
									value={search.folderId}
									onChange={(id) => update({ folderId: id })}
								/>
							</div>
						</CardContent>
					</Card>
				</aside>
			</div>

			<BulkEdit
				open={bulkOpen}
				onOpenChange={setBulkOpen}
				selectedIds={Array.from(selected)}
				onCompleted={clearSelection}
			/>
		</>
	);
}

function ImageGrid({
	items,
	hash,
	selected,
	onToggleOne,
}: {
	items: Array<ImageCacheRow>;
	hash: string;
	selected: Set<string>;
	onToggleOne: (id: string, checked: boolean) => void;
}) {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
			{items.map((img) => {
				const variants = parseVariants(img.variants);
				const thumb = hash ? pickThumbnailUrl(hash, img.id, variants) : "";
				const isSelected = selected.has(img.id);
				return (
					<div
						key={img.id}
						className={`group relative overflow-hidden rounded-md border bg-muted ${
							isSelected ? "ring-2 ring-primary" : ""
						}`}
					>
						{/* Selection checkbox — overlay, separate from the link so it
						    doesn't navigate when toggled. */}
						<button
							type="button"
							aria-label={isSelected ? "Deselect image" : "Select image"}
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onToggleOne(img.id, !isSelected);
							}}
							className={`absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-sm bg-black/60 text-white transition ${
								isSelected
									? "opacity-100"
									: "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
							}`}
						>
							<Checkbox
								checked={isSelected}
								// Toggle is handled by the wrapper button.
								onCheckedChange={() => onToggleOne(img.id, !isSelected)}
								className="bg-white"
							/>
						</button>
						<Link
							to="/images/$imageId"
							params={{ imageId: img.id }}
							className="block"
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
					</div>
				);
			})}
		</div>
	);
}

function ImageTable({
	items,
	clientNames,
	selected,
	onToggleOne,
	onToggleAll,
}: {
	items: Array<ImageCacheRow>;
	clientNames: Record<string, string>;
	selected: Set<string>;
	onToggleOne: (id: string, checked: boolean) => void;
	onToggleAll: (checked: boolean) => void;
}) {
	const allOnPageSelected =
		items.length > 0 && items.every((it) => selected.has(it.id));
	const columns: Array<ColumnDef<ImageCacheRow>> = [
		{
			id: "select",
			header: () => (
				<Checkbox
					checked={allOnPageSelected}
					onCheckedChange={(v) => onToggleAll(v === true)}
					aria-label="Select all on page"
				/>
			),
			cell: ({ row }) => {
				const isSelected = selected.has(row.original.id);
				return (
					<Checkbox
						checked={isSelected}
						onCheckedChange={(v) => onToggleOne(row.original.id, v === true)}
						aria-label="Select image"
					/>
				);
			},
		},
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
