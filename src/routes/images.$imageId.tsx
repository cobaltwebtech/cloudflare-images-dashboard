import { ArrowLeftIcon, TrashIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClientFolderFields } from "@/components/client-folder-fields";
import { CopyButton } from "@/components/copy-button";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { buildDeliveryUrl, parseVariantName } from "@/lib/cf-url";
import { formatDate, parseVariants, validateMeta } from "@/lib/format";
import {
	configQueryOptions,
	imageDetailQueryOptions,
	queryKeys,
} from "@/lib/queries";
import { deleteImage, updateImage } from "@/server/images";

export const Route = createFileRoute("/images/$imageId")({
	component: ImageDetail,
});

// JSX-bulk complexity from inline callbacks; cognitive complexity is 6.
// fallow-ignore-next-line complexity
function ImageDetail() {
	const { imageId } = Route.useParams();
	const router = useRouter();
	const queryClient = useQueryClient();

	const image = useQuery(imageDetailQueryOptions(imageId));
	const config = useQuery(configQueryOptions());

	const updateMut = useMutation({
		mutationFn: updateImage,
		onSuccess: () => {
			toast.success("Image updated");
			queryClient.invalidateQueries({
				queryKey: queryKeys.images.detail(imageId),
			});
			queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const deleteMut = useMutation({
		mutationFn: deleteImage,
		onSuccess: () => {
			toast.success("Image deleted");
			queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.stats });
			router.navigate({ to: "/images" });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	if (image.isLoading) {
		return <Skeleton className="h-96 w-full" />;
	}
	if (!image.data) return null;

	const img = image.data;
	const hash = config.data?.imagesHash ?? "";
	const variants = parseVariants(img.variants);
	const preview = hash ? buildDeliveryUrl(hash, img.id, "mdpublic") : "";

	return (
		<>
			<PageHeader
				title={img.filename ?? img.id}
				description={img.id}
				actions={
					<>
						<Button asChild variant="outline">
							<Link to="/images">
								<ArrowLeftIcon /> Back
							</Link>
						</Button>
						<DeleteImageButton
							onConfirm={() => deleteMut.mutate({ data: { id: img.id } })}
							pending={deleteMut.isPending}
						/>
					</>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[1fr_400px]">
				<div>
					<ImagePreviewCard preview={preview} alt={img.filename ?? img.id} />
					<VariantsCard variants={variants} />
				</div>

				<div>
					<Tabs defaultValue="settings" className="flex flex-col w-full">
						<TabsList className="w-full">
							<TabsTrigger value="settings" className="p-2">
								Settings
							</TabsTrigger>
							<TabsTrigger value="metadata" className="p-2">
								Metadata
							</TabsTrigger>
							<TabsTrigger value="info" className="p-2">
								Info
							</TabsTrigger>
						</TabsList>

						<TabsContent value="settings">
							<SettingsPanel
								image={img}
								onSave={(patch) =>
									updateMut.mutate({ data: { id: img.id, ...patch } })
								}
								pending={updateMut.isPending}
							/>
						</TabsContent>

						<TabsContent value="metadata">
							<MetadataPanel
								image={img}
								onSave={(meta) =>
									updateMut.mutate({ data: { id: img.id, meta } })
								}
								pending={updateMut.isPending}
							/>
						</TabsContent>

						<TabsContent value="info">
							<ImageInfoCard image={img} />
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</>
	);
}

function ImagePreviewCard({ preview, alt }: { preview: string; alt: string }) {
	return (
		<Card>
			<CardContent className="flex items-center justify-center bg-muted p-4">
				{preview ? (
					<img
						src={preview}
						alt={alt}
						className="max-h-[600px] w-auto object-contain"
					/>
				) : (
					<div className="flex h-96 w-full items-center justify-center text-sm text-muted-foreground">
						No preview available
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function VariantsCard({ variants }: { variants: Array<string> }) {
	return (
		<Card className="mt-4">
			<CardHeader>
				<CardTitle className="text-base">Variants</CardTitle>
				<CardDescription>
					Select a variant to copy the absolute URL.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{variants.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No variants configured.
					</p>
				) : (
					<div className="flex items-center flex-wrap gap-2">
						{variants.map((url) => (
							<div
								key={url}
								className="flex items-center justify-between gap-2 rounded-md border p-2"
							>
								<Badge variant="outline">{parseVariantName(url)}</Badge>
								<CopyButton value={url} label="Copy URL" />
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function ImageInfoCard({
	image,
}: {
	image: {
		id: string;
		filename: string | null;
		uploadedAt: Date | string | number | null;
		lastSyncedAt: Date | string | number | null;
		creator: string | null;
		requireSignedUrls: boolean;
	};
}) {
	return (
		<Card>
			<CardContent className="space-y-2 p-4 text-sm">
				<InfoRow label="ID" value={image.id} />
				<InfoRow label="Filename" value={image.filename ?? "—"} />
				<InfoRow label="Uploaded" value={formatDate(image.uploadedAt)} />
				<InfoRow label="Last synced" value={formatDate(image.lastSyncedAt)} />
				<InfoRow label="Creator" value={image.creator ?? "—"} />
				<InfoRow
					label="Signed URLs"
					value={image.requireSignedUrls ? "Required" : "Public"}
				/>
			</CardContent>
		</Card>
	);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="truncate text-right">{value}</span>
		</div>
	);
}

function SettingsPanel({
	image,
	onSave,
	pending,
}: {
	image: {
		id: string;
		clientId: string | null;
		folderId: string | null;
		requireSignedUrls: boolean;
		creator: string | null;
	};
	onSave: (patch: {
		clientId?: string | null;
		folderId?: string | null;
		requireSignedURLs?: boolean;
		creator?: string | null;
	}) => void;
	pending: boolean;
}) {
	const [clientId, setClientId] = useState<string | null>(image.clientId);
	const [folderId, setFolderId] = useState<string | null>(image.folderId);
	const [signed, setSigned] = useState(image.requireSignedUrls);
	const [creator, setCreator] = useState(image.creator ?? "");

	return (
		<Card>
			<CardContent className="space-y-4 p-4">
				<ClientFolderFields
					clientId={clientId}
					folderId={folderId}
					onClientChange={setClientId}
					onFolderChange={setFolderId}
				/>
				<div>
					<Label htmlFor="creator" className="mb-1">
						Creator
					</Label>
					<Input
						id="creator"
						value={creator}
						onChange={(e) => setCreator(e.target.value)}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Switch id="signed" checked={signed} onCheckedChange={setSigned} />
					<Label htmlFor="signed">Require signed URLs</Label>
				</div>
				<Button
					className="w-full"
					disabled={pending}
					onClick={() =>
						onSave({
							clientId,
							folderId,
							requireSignedURLs: signed,
							creator: creator || null,
						})
					}
				>
					{pending ? "Saving…" : "Save changes"}
				</Button>
			</CardContent>
		</Card>
	);
}

function MetadataPanel({
	image,
	onSave,
	pending,
}: {
	image: { meta: string | null };
	onSave: (meta: Record<string, unknown>) => void;
	pending: boolean;
}) {
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);

	// Initialize once when image data arrives.
	useEffect(() => {
		setText(formatJson(image.meta));
	}, [image.meta]);

	function handleSave() {
		const result = validateMeta(text);
		if (!result.ok) {
			setError(result.error);
			return;
		}
		setError(null);
		onSave(result.value);
	}

	return (
		<Card>
			<CardContent className="space-y-3 p-4">
				<Label htmlFor="meta">Metadata (JSON object, ≤ 1024 bytes)</Label>
				<Textarea
					id="meta"
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={12}
					className="font-mono text-xs"
					spellCheck={false}
				/>
				{error ? <p className="text-xs text-destructive">{error}</p> : null}
				<Button className="w-full" disabled={pending} onClick={handleSave}>
					{pending ? "Saving…" : "Save metadata"}
				</Button>
			</CardContent>
		</Card>
	);
}

function formatJson(meta: string | null): string {
	if (!meta) return "{}";
	try {
		return JSON.stringify(JSON.parse(meta), null, 2);
	} catch {
		return meta;
	}
}

function DeleteImageButton({
	onConfirm,
	pending,
}: {
	onConfirm: () => void;
	pending: boolean;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive" disabled={pending}>
					<TrashIcon /> Delete
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete image?</AlertDialogTitle>
					<AlertDialogDescription>
						This permanently removes the image from Cloudflare. This cannot be
						undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
