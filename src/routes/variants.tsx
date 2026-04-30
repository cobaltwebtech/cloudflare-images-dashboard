import { PencilSimpleIcon, PlusIcon, ResizeIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DialogActionFooter } from "@/components/dialog-action-footer";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { queryKeys, variantsQueryOptions } from "@/lib/queries";
import { createVariant, deleteVariant, updateVariant } from "@/server/variants";

export const Route = createFileRoute("/variants")({ component: VariantsPage });

const FITS = ["scale-down", "contain", "cover", "crop", "pad"] as const;
const META = ["keep", "copyright", "none"] as const;

type Fit = (typeof FITS)[number];
type Meta = (typeof META)[number];
type VariantOptions = {
	fit: Fit;
	width?: number;
	height?: number;
	metadata: Meta;
};
type VariantRow = {
	id: string;
	options: VariantOptions;
	neverRequireSignedURLs?: boolean;
};

function VariantsPage() {
	const queryClient = useQueryClient();
	const variants = useQuery(variantsQueryOptions());

	const list: Array<VariantRow> = Object.entries(variants.data ?? {}).map(
		([id, v]) => {
			const obj = v as {
				options?: Partial<VariantOptions>;
				neverRequireSignedURLs?: boolean;
			};
			const opts = obj.options ?? {};
			return {
				id,
				options: {
					fit: (opts.fit ?? "scale-down") as Fit,
					width: opts.width != null ? Number(opts.width) : undefined,
					height: opts.height != null ? Number(opts.height) : undefined,
					metadata: (opts.metadata ?? "none") as Meta,
				},
				neverRequireSignedURLs: obj.neverRequireSignedURLs,
			};
		},
	);

	function refresh() {
		queryClient.invalidateQueries({ queryKey: queryKeys.variants });
	}

	return (
		<>
			<PageHeader
				title="Variants"
				description="Resize/crop presets applied to image URLs."
				actions={
					<VariantFormDialog
						mode={{
							kind: "create",
							trigger: (
								<Button>
									<PlusIcon /> New variant
								</Button>
							),
						}}
						onSuccess={refresh}
					/>
				}
			/>

			{variants.isLoading ? (
				<Skeleton className="h-64 w-full" />
			) : list.length === 0 ? (
				<EmptyState
					icon={<ResizeIcon className="size-10" />}
					title="No variants yet"
					description="Create a variant to deliver resized images."
					action={
						<VariantFormDialog
							mode={{
								kind: "create",
								trigger: (
									<Button>
										<PlusIcon /> New variant
									</Button>
								),
							}}
							onSuccess={refresh}
						/>
					}
				/>
			) : (
				<Card>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Fit</TableHead>
								<TableHead>Size</TableHead>
								<TableHead>Metadata</TableHead>
								<TableHead>Signed</TableHead>
								<TableHead className="w-32 text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{list.map((v) => (
								<TableRow key={v.id}>
									<TableCell className="font-medium">
										<div className="flex items-center gap-2">{v.id}</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline">{v.options.fit}</Badge>
									</TableCell>
									<TableCell>
										{v.options.width ?? "auto"} × {v.options.height ?? "auto"}
									</TableCell>
									<TableCell>{v.options.metadata}</TableCell>
									<TableCell>
										{v.neverRequireSignedURLs ? (
											<Badge variant="secondary">Never signed</Badge>
										) : null}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<VariantFormDialog
												mode={{
													kind: "edit",
													variant: v,
													trigger: (
														<Button variant="ghost" size="icon" title="Edit">
															<PencilSimpleIcon />
														</Button>
													),
												}}
												onSuccess={refresh}
											/>
											<DeleteVariantButton id={v.id} onSuccess={refresh} />
										</div>
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

type DialogMode =
	| { kind: "create"; trigger: React.ReactNode }
	| { kind: "edit"; trigger: React.ReactNode; variant: VariantRow };

type VariantFormState = {
	id: string;
	fit: Fit;
	width: string;
	height: string;
	metadata: Meta;
	publicVariant: boolean;
};

function buildVariantPayload(s: VariantFormState) {
	const w = s.width.trim() ? Number(s.width) : undefined;
	const h = s.height.trim() ? Number(s.height) : undefined;
	if (w == null && h == null) {
		throw new Error("Set at least one of width or height");
	}
	return {
		id: s.id,
		options: { fit: s.fit, width: w, height: h, metadata: s.metadata },
		neverRequireSignedURLs: s.publicVariant,
	};
}

function VariantFormFields({
	state,
	disableId,
	onChange,
}: {
	state: VariantFormState;
	disableId: boolean;
	onChange: <K extends keyof VariantFormState>(
		key: K,
		value: VariantFormState[K],
	) => void;
}) {
	return (
		<div className="space-y-3">
			<div>
				<Label htmlFor="v-id" className="mb-1">
					Name
				</Label>
				<Input
					id="v-id"
					value={state.id}
					onChange={(e) => onChange("id", e.target.value)}
					placeholder="thumbnail"
					disabled={disableId}
					autoFocus
				/>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div>
					<Label htmlFor="v-w" className="mb-1">
						Width
					</Label>
					<Input
						id="v-w"
						type="number"
						min={1}
						value={state.width}
						onChange={(e) => onChange("width", e.target.value)}
						placeholder="auto"
					/>
				</div>
				<div>
					<Label htmlFor="v-h" className="mb-1">
						Height
					</Label>
					<Input
						id="v-h"
						type="number"
						min={1}
						value={state.height}
						onChange={(e) => onChange("height", e.target.value)}
						placeholder="auto"
					/>
				</div>
			</div>
			<p className="text-xs text-muted-foreground -mt-1">
				Leave one blank to scale by aspect ratio.
			</p>
			<div>
				<Label className="mb-1">Fit</Label>
				<Select
					value={state.fit}
					onValueChange={(v) => onChange("fit", v as Fit)}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FITS.map((f) => (
							<SelectItem key={f} value={f}>
								{f}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div>
				<Label className="mb-1">Metadata</Label>
				<Select
					value={state.metadata}
					onValueChange={(v) => onChange("metadata", v as Meta)}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{META.map((m) => (
							<SelectItem key={m} value={m}>
								{m}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex items-center gap-2">
				<Switch
					id="v-signed"
					checked={state.publicVariant}
					onCheckedChange={(v) => onChange("publicVariant", v)}
				/>
				<Label htmlFor="v-signed">Make Variant Public</Label>
			</div>
		</div>
	);
}

// Cyclomatic count is from the create/edit unification (isEdit branches);
// splitting would re-introduce duplication. Cognitive complexity is 10.
// fallow-ignore-next-line complexity
function VariantFormDialog({
	mode,
	onSuccess,
}: {
	mode: DialogMode;
	onSuccess: () => void;
}) {
	const initial = mode.kind === "edit" ? mode.variant : null;
	const isEdit = mode.kind === "edit";
	const [open, setOpen] = useState(false);
	const [state, setState] = useState<VariantFormState>({
		id: initial?.id ?? "",
		fit: initial?.options.fit ?? "scale-down",
		width: initial?.options.width != null ? String(initial.options.width) : "",
		height:
			initial?.options.height != null ? String(initial.options.height) : "",
		metadata: initial?.options.metadata ?? "none",
		publicVariant: initial?.neverRequireSignedURLs ?? false,
	});

	const updateField = <K extends keyof VariantFormState>(
		key: K,
		value: VariantFormState[K],
	) => setState((prev) => ({ ...prev, [key]: value }));

	const mutation = useMutation({
		mutationFn: async () => {
			const payload = buildVariantPayload(state);
			return isEdit
				? updateVariant({ data: payload })
				: createVariant({ data: payload });
		},
		onSuccess: () => {
			toast.success(isEdit ? "Variant updated" : "Variant created");
			setOpen(false);
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{mode.trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEdit ? `Edit "${state.id}"` : "New variant"}
					</DialogTitle>
				</DialogHeader>
				<VariantFormFields
					state={state}
					disableId={isEdit}
					onChange={updateField}
				/>
				<DialogActionFooter
					onCancel={() => setOpen(false)}
					onSubmit={() => mutation.mutate()}
					submitLabel={isEdit ? "Save" : "Create"}
					disabled={!state.id.trim() || mutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
}

function DeleteVariantButton({
	id,
	onSuccess,
}: {
	id: string;
	onSuccess: () => void;
}) {
	const mutation = useMutation({
		mutationFn: deleteVariant,
		onSuccess: () => {
			toast.success("Variant deleted");
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<ConfirmDeleteButton
			title={`Delete variant "${id}"?`}
			description="All images using this variant will lose its URL. Cache is purged."
			isPending={mutation.isPending}
			onConfirm={() => mutation.mutate({ data: { id } })}
		/>
	);
}
