import { PlusIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientFormDialog } from "@/components/client-form-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { clientsQueryOptions, imagesListQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/clients/")({ component: ClientsPage });

function ClientImageCount({ clientId }: { clientId: string }) {
	const images = useQuery(
		imagesListQueryOptions({ clientId, limit: 1, offset: 0 }),
	);
	if (images.isLoading) return null;
	const n = images.data?.total ?? 0;
	return (
		<p className="mt-1 text-xs text-muted-foreground">
			{formatNumber(n)} {n === 1 ? "image" : "images"}
		</p>
	);
}

function ClientsPage() {
	const clients = useQuery(clientsQueryOptions());

	return (
		<>
			<PageHeader
				title="Clients"
				description="Group images by the customer they belong to."
				actions={
					<ClientFormDialog
						mode={{
							kind: "create",
							trigger: (
								<Button>
									<PlusIcon /> Add Client
								</Button>
							),
						}}
						onSuccess={() => {}}
					/>
				}
			/>

			{clients.isLoading ? (
				<Skeleton className="h-64 w-full" />
			) : (clients.data ?? []).length === 0 ? (
				<EmptyState
					icon={<UsersThreeIcon className="size-10" />}
					title="No clients yet"
					description="Create a client to start grouping images."
					action={
						<ClientFormDialog
							mode={{
								kind: "create",
								trigger: (
									<Button>
										<PlusIcon /> Add Client
									</Button>
								),
							}}
							onSuccess={() => {}}
						/>
					}
				/>
			) : (
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
					{(clients.data ?? []).map((c) => (
						<Link
							key={c.id}
							to="/clients/$clientId"
							params={{ clientId: c.id }}
							className="block"
						>
							<Card className="transition hover:border-primary/40 hover:shadow-sm">
								<CardContent className="flex items-start gap-3 p-4">
									<div
										className="size-10 shrink-0 rounded-md border"
										style={{ backgroundColor: c.color ?? "#e5e5e5" }}
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium">{c.name}</p>
										{c.domain ? (
											<p className="truncate text-xs text-muted-foreground">
												{c.domain}
											</p>
										) : null}
										{c.description ? (
											<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
												{c.description}
											</p>
										) : null}
										<ClientImageCount clientId={c.id} />
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			)}
		</>
	);
}
