import { KeyIcon, PlusIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CopyButton } from "@/components/copy-button";
import { DialogActionFooter } from "@/components/dialog-action-footer";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateShort } from "@/lib/format";
import { queryKeys, signingKeysQueryOptions } from "@/lib/queries";
import { createSigningKey, deleteSigningKey } from "@/server/keys";

export const Route = createFileRoute("/signing-keys")({
	component: SigningKeysPage,
});

type Key = { name?: string; value?: string; date?: string };

function SigningKeysPage() {
	const queryClient = useQueryClient();
	const keys = useQuery(signingKeysQueryOptions());

	function refresh() {
		queryClient.invalidateQueries({ queryKey: queryKeys.signingKeys });
	}

	const list = (keys.data ?? []) as Array<Key>;

	return (
		<>
			<PageHeader
				title="Signing Keys"
				description="Used to mint signed URLs for private images."
				actions={<NewKeyButton onSuccess={refresh} />}
			/>

			<Alert className="mb-4">
				<AlertTitle>About signing keys</AlertTitle>
				<AlertDescription>
					Cloudflare auto-generates a default signing key. Multiple keys can be
					active at once. When the last key is deleted, CF auto-creates a new
					one.
				</AlertDescription>
			</Alert>

			{keys.isLoading ? (
				<Skeleton className="h-48 w-full" />
			) : list.length === 0 ? (
				<EmptyState
					icon={<KeyIcon className="size-10" />}
					title="No signing keys"
					description="Create a key to start signing image URLs."
					action={<NewKeyButton onSuccess={refresh} />}
				/>
			) : (
				<Card>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Value</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="w-24 text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{list.map((k) => (
								<TableRow key={k.name ?? k.value}>
									<TableCell className="font-medium">{k.name ?? "—"}</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<code className="truncate text-xs text-muted-foreground">
												{k.value ? `${"•".repeat(8)}${k.value.slice(-6)}` : "—"}
											</code>
											{k.value ? (
												<CopyButton value={k.value} label="Copy key" />
											) : null}
										</div>
									</TableCell>
									<TableCell>{formatDateShort(k.date)}</TableCell>
									<TableCell className="text-right">
										{k.name ? (
											<DeleteKeyButton name={k.name} onSuccess={refresh} />
										) : null}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Card>
			)}
		</>
	);
}

function NewKeyButton({ onSuccess }: { onSuccess: () => void }) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");

	const mutation = useMutation({
		mutationFn: createSigningKey,
		onSuccess: () => {
			toast.success("Key created");
			setOpen(false);
			setName("");
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon /> New key
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New signing key</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="key-name">Name</Label>
					<Input
						id="key-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="my-key"
						autoFocus
					/>
					<p className="text-xs text-muted-foreground">
						Letters, numbers, dashes, underscores only.
					</p>
				</div>
				<DialogActionFooter
					onCancel={() => setOpen(false)}
					onSubmit={() => mutation.mutate({ data: { name: name.trim() } })}
					submitLabel="Create"
					disabled={!name.trim() || mutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
}

function DeleteKeyButton({
	name,
	onSuccess,
}: {
	name: string;
	onSuccess: () => void;
}) {
	const mutation = useMutation({
		mutationFn: deleteSigningKey,
		onSuccess: () => {
			toast.success("Key deleted");
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<ConfirmDeleteButton
			title={`Delete key "${name}"?`}
			description="URLs signed with this key will stop working immediately."
			isPending={mutation.isPending}
			onConfirm={() => mutation.mutate({ data: { name } })}
		/>
	);
}
