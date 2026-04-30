import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DialogActionFooter } from "@/components/dialog-action-footer";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/db/db-schema";
import { queryKeys } from "@/lib/queries";
import { createClient, updateClient } from "@/server/clients";

type Mode =
	| { kind: "create"; trigger: React.ReactNode }
	| { kind: "edit"; trigger: React.ReactNode; client: Client };

type ClientFormState = {
	name: string;
	website: string;
	description: string;
	color: string;
	creator: string;
};

const DEFAULT_COLOR = "#94a3b8";

// Cyclomatic count comes from per-field nullish coalesces; cognitive is 4.
// fallow-ignore-next-line complexity
function initialFormState(client: Client | null): ClientFormState {
	return {
		name: client?.name ?? "",
		website: client?.website ?? "",
		description: client?.description ?? "",
		color: client?.color ?? DEFAULT_COLOR,
		creator: client?.creator ?? "",
	};
}

function buildClientPayload(s: ClientFormState) {
	return {
		name: s.name.trim(),
		website: s.website.trim() || null,
		description: s.description.trim() || null,
		color: s.color || null,
		creator: s.creator.trim() || null,
	};
}

function ClientFormFields({
	state,
	onChange,
}: {
	state: ClientFormState;
	onChange: <K extends keyof ClientFormState>(
		key: K,
		value: ClientFormState[K],
	) => void;
}) {
	return (
		<div className="space-y-3">
			<div>
				<Label htmlFor="client-name" className="mb-1">
					Name
				</Label>
				<Input
					id="client-name"
					value={state.name}
					onChange={(e) => onChange("name", e.target.value)}
					autoFocus
				/>
			</div>
			<div>
				<Label htmlFor="client-website" className="mb-1">
					Website
				</Label>
				<Input
					id="client-website"
					type="url"
					value={state.website}
					onChange={(e) => onChange("website", e.target.value)}
					placeholder="https://example.com"
				/>
			</div>
			<div>
				<Label htmlFor="client-creator" className="mb-1">
					Creator
				</Label>
				<Input
					id="client-creator"
					value={state.creator}
					onChange={(e) => onChange("creator", e.target.value)}
					placeholder="e.g. example.com"
				/>
				<p className="mt-1 text-xs text-muted-foreground">
					Cloudflare Images <code>creator</code> value to auto-link images by.
					Any image with this creator is assigned to this client.
				</p>
			</div>
			<div>
				<Label htmlFor="client-color" className="mb-1">
					Color
				</Label>
				<div className="flex items-center gap-2">
					<input
						id="client-color"
						type="color"
						value={state.color || DEFAULT_COLOR}
						onChange={(e) => onChange("color", e.target.value)}
						className="h-9 w-14 cursor-pointer rounded-md border"
					/>
					<Input
						value={state.color}
						onChange={(e) => onChange("color", e.target.value)}
						placeholder={DEFAULT_COLOR}
					/>
				</div>
			</div>
			<div>
				<Label htmlFor="client-description" className="mb-1">
					Description
				</Label>
				<Textarea
					id="client-description"
					value={state.description}
					onChange={(e) => onChange("description", e.target.value)}
					rows={3}
				/>
			</div>
		</div>
	);
}

export function ClientFormDialog({
	mode,
	onSuccess,
}: {
	mode: Mode;
	onSuccess: () => void;
}) {
	const initial = mode.kind === "edit" ? mode.client : null;
	const isEdit = mode.kind === "edit";
	const [open, setOpen] = useState(false);
	const [state, setState] = useState<ClientFormState>(() =>
		initialFormState(initial),
	);

	const updateField = <K extends keyof ClientFormState>(
		key: K,
		value: ClientFormState[K],
	) => setState((prev) => ({ ...prev, [key]: value }));

	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: async () => {
			const payload = buildClientPayload(state);
			return isEdit && mode.kind === "edit"
				? updateClient({ data: { id: mode.client.id, ...payload } })
				: createClient({ data: payload });
		},
		onSuccess: () => {
			toast.success(isEdit ? "Client updated" : "Client created");
			queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
			setOpen(false);
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (o) setState(initialFormState(initial));
			}}
		>
			<DialogTrigger asChild>{mode.trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
				</DialogHeader>
				<ClientFormFields state={state} onChange={updateField} />
				<DialogActionFooter
					onCancel={() => setOpen(false)}
					onSubmit={() => mutation.mutate()}
					submitLabel={isEdit ? "Save" : "Create"}
					disabled={!state.name.trim() || mutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
}
