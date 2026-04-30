import {
	ArrowLeftIcon,
	ArrowSquareOutIcon,
	PencilSimpleIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { PageHeader } from "@/components/page-header";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Client, ImageCacheRow } from "@/db/db-schema";
import { pickThumbnailUrl } from "@/lib/cf-url";
import { formatDateShort, formatNumber, parseVariants } from "@/lib/format";
import {
	clientDetailQueryOptions,
	configQueryOptions,
	imagesListQueryOptions,
	queryKeys,
} from "@/lib/queries";
import { deleteClient } from "@/server/clients";

export const Route = createFileRoute("/clients/$clientId")({
	component: ClientDetail,
});

function ClientInfoCard({ client }: { client: Client }) {
	return (
		<Card>
			<CardContent className="space-y-3 p-4 text-sm">
				<div className="flex items-center gap-3">
					<div
						className="size-10 rounded-md border"
						style={{ backgroundColor: client.color ?? "#e5e5e5" }}
					/>
					<div>
						<p className="font-medium">{client.name}</p>
						<p className="text-xs text-muted-foreground">
							Created {formatDateShort(client.createdAt)}
						</p>
					</div>
				</div>
				{client.website ? (
					<a
						href={client.website}
						target="_blank"
						rel="noreferrer noopener"
						className="flex items-center gap-1 text-sm hover:underline"
					>
						<ArrowSquareOutIcon /> {client.website}
					</a>
				) : null}
				{client.creator ? (
					<p className="text-xs text-muted-foreground">
						Auto-links images with creator{" "}
						<code className="rounded bg-muted px-1 py-0.5">
							{client.creator}
						</code>
					</p>
				) : null}
				{client.description ? (
					<p className="text-muted-foreground">{client.description}</p>
				) : null}
			</CardContent>
		</Card>
	);
}

function ClientImageThumb({ img, hash }: { img: ImageCacheRow; hash: string }) {
	const variants = parseVariants(img.variants);
	const thumb = hash ? pickThumbnailUrl(hash, img.id, variants) : "";
	const showImage = thumb && !img.requireSignedUrls;
	return (
		<Link
			to="/images/$imageId"
			params={{ imageId: img.id }}
			className="group block aspect-square overflow-hidden rounded-md border bg-muted"
		>
			{showImage ? (
				<img
					src={thumb}
					alt={img.filename ?? img.id}
					className="h-full w-full object-cover transition group-hover:scale-105"
					loading="lazy"
				/>
			) : (
				<div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
					{img.requireSignedUrls ? "Signed" : "—"}
				</div>
			)}
		</Link>
	);
}

function ClientImagesGrid({
	items,
	hash,
	isLoading,
	total,
}: {
	items: Array<ImageCacheRow>;
	hash: string;
	isLoading: boolean;
	total: number;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">
					Images ({formatNumber(total)})
				</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-32 w-full" />
				) : items.length === 0 ? (
					<p className="text-sm text-muted-foreground">No images yet.</p>
				) : (
					<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
						{items.map((img) => (
							<ClientImageThumb key={img.id} img={img} hash={hash} />
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function DeleteClientDialog({
	onConfirm,
	isPending,
}: {
	onConfirm: () => void;
	isPending: boolean;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive">
					<TrashIcon /> Delete
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete client?</AlertDialogTitle>
					<AlertDialogDescription>
						Images linked to this client will keep existing but will no longer
						be associated.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction disabled={isPending} onClick={onConfirm}>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

// JSX-bulk complexity from inline callbacks; cognitive complexity is 6.
// fallow-ignore-next-line complexity
function ClientDetail() {
	const { clientId } = Route.useParams();
	const router = useRouter();
	const queryClient = useQueryClient();

	const client = useQuery(clientDetailQueryOptions(clientId));
	const images = useQuery(
		imagesListQueryOptions({ clientId, limit: 50, offset: 0 }),
	);
	const config = useQuery(configQueryOptions());

	const deleteMut = useMutation({
		mutationFn: deleteClient,
		onSuccess: () => {
			toast.success("Client deleted");
			queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
			router.navigate({ to: "/clients" });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	if (client.isLoading) return <Skeleton className="h-64 w-full" />;
	if (!client.data) {
		return (
			<Card>
				<CardContent className="p-8 text-center">
					<p className="font-medium">Client not found.</p>
					<Button asChild variant="outline" className="mt-4">
						<Link to="/clients">Back to clients</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	const c = client.data;
	const hash = config.data?.imagesHash ?? "";

	return (
		<>
			<PageHeader
				title={c.name}
				description={c.description ?? undefined}
				actions={
					<>
						<Button asChild variant="outline">
							<Link to="/clients">
								<ArrowLeftIcon /> Back
							</Link>
						</Button>
						<ClientFormDialog
							mode={{
								kind: "edit",
								client: c,
								trigger: (
									<Button variant="outline">
										<PencilSimpleIcon /> Edit
									</Button>
								),
							}}
							onSuccess={() =>
								queryClient.invalidateQueries({
									queryKey: queryKeys.clients.detail(clientId),
								})
							}
						/>
						<DeleteClientDialog
							onConfirm={() => deleteMut.mutate({ data: { id: c.id } })}
							isPending={deleteMut.isPending}
						/>
					</>
				}
			/>

			<div className="grid gap-4 lg:grid-cols-[300px_1fr]">
				<ClientInfoCard client={c} />
				<ClientImagesGrid
					items={images.data?.items ?? []}
					hash={hash}
					isLoading={images.isLoading}
					total={images.data?.total ?? 0}
				/>
			</div>
		</>
	);
}
