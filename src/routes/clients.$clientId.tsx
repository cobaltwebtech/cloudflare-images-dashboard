import {
	ArrowLeftIcon,
	ArrowSquareOutIcon,
	ImagesIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	buildClientPayload,
	ClientFormFields,
	type ClientFormState,
	initialFormState,
} from "@/components/client-form-dialog";
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
import type { Client } from "@/db/db-schema";
import { formatDateShort, formatNumber } from "@/lib/format";
import {
	clientDetailQueryOptions,
	imagesListQueryOptions,
	queryKeys,
} from "@/lib/queries";
import { deleteClient, updateClient } from "@/server/clients";

export const Route = createFileRoute("/clients/$clientId")({
	component: ClientDetail,
});

function ClientSummaryCard({
	client,
	imageCount,
	isCountLoading,
}: {
	client: Client;
	imageCount: number;
	isCountLoading: boolean;
}) {
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
				<div className="pt-2">
					<Button asChild variant="outline" className="w-full">
						<Link to="/images" search={{ clientId: client.id }}>
							<ImagesIcon />
							View {isCountLoading ? "" : `${formatNumber(imageCount)} `}
							{imageCount === 1 ? "image" : "images"}
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function ClientEditCard({
	client,
	onSaved,
}: {
	client: Client;
	onSaved: () => void;
}) {
	const queryClient = useQueryClient();
	const [state, setState] = useState<ClientFormState>(() =>
		initialFormState(client),
	);

	// Keep the form in sync with the underlying client (e.g. after a save
	// invalidates and refetches the query).
	useEffect(() => {
		setState(initialFormState(client));
	}, [client]);

	const updateField = <K extends keyof ClientFormState>(
		key: K,
		value: ClientFormState[K],
	) => setState((prev) => ({ ...prev, [key]: value }));

	const mutation = useMutation({
		mutationFn: () =>
			updateClient({
				data: { id: client.id, ...buildClientPayload(state) },
			}),
		onSuccess: () => {
			toast.success("Client updated");
			queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
			onSaved();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Edit client</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<ClientFormFields state={state} onChange={updateField} />
				<div className="flex items-center justify-end gap-2">
					<Button
						variant="outline"
						onClick={() => setState(initialFormState(client))}
						disabled={mutation.isPending}
					>
						Reset
					</Button>
					<Button
						onClick={() => mutation.mutate()}
						disabled={!state.name.trim() || mutation.isPending}
					>
						{mutation.isPending ? "Saving…" : "Save"}
					</Button>
				</div>
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

function ClientDetail() {
	const { clientId } = Route.useParams();
	const router = useRouter();
	const queryClient = useQueryClient();

	const client = useQuery(clientDetailQueryOptions(clientId));
	// Lightweight query: just need the total count for display.
	const images = useQuery(
		imagesListQueryOptions({ clientId, limit: 1, offset: 0 }),
	);

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
						<DeleteClientDialog
							onConfirm={() => deleteMut.mutate({ data: { id: c.id } })}
							isPending={deleteMut.isPending}
						/>
					</>
				}
			/>

			<div className="grid gap-4 lg:grid-cols-[300px_1fr]">
				<ClientSummaryCard
					client={c}
					imageCount={images.data?.total ?? 0}
					isCountLoading={images.isLoading}
				/>
				<ClientEditCard
					client={c}
					onSaved={() =>
						queryClient.invalidateQueries({
							queryKey: queryKeys.clients.detail(clientId),
						})
					}
				/>
			</div>
		</>
	);
}
