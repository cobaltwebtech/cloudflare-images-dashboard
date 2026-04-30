import { CloudArrowUpIcon, ImageIcon, XIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { ClientFolderFields } from "@/components/client-folder-fields";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes, validateMeta } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import { uploadImage } from "@/server/images";

export const Route = createFileRoute("/upload")({
	component: UploadPage,
});

type UploadFormState = {
	mode: "file" | "url";
	file: File | null;
	url: string;
	customId: string;
	creator: string;
	clientId: string | null;
	folderId: string | null;
	meta: string;
	signed: boolean;
};

function buildUploadFormData(s: UploadFormState): FormData {
	const fd = new FormData();
	if (s.mode === "file" && s.file) fd.append("file", s.file);
	if (s.mode === "url") fd.append("url", s.url.trim());
	if (s.customId.trim()) fd.append("id", s.customId.trim());
	if (s.creator.trim()) fd.append("creator", s.creator.trim());
	if (s.clientId) fd.append("clientId", s.clientId);
	if (s.folderId) fd.append("folderId", s.folderId);
	if (s.meta.trim()) fd.append("meta", s.meta.trim());
	fd.append("requireSignedURLs", String(s.signed));
	return fd;
}

function UploadPage() {
	const router = useRouter();
	const queryClient = useQueryClient();

	const [mode, setMode] = useState<"file" | "url">("file");
	const [file, setFile] = useState<File | null>(null);
	const [url, setUrl] = useState("");
	const [customId, setCustomId] = useState("");
	const [creator, setCreator] = useState("");
	const [clientId, setClientId] = useState<string | null>(null);
	const [folderId, setFolderId] = useState<string | null>(null);
	const [signed, setSigned] = useState(false);
	const [meta, setMeta] = useState("");
	const [metaError, setMetaError] = useState<string | null>(null);

	const onDrop = useCallback((files: Array<File>) => {
		if (files[0]) setFile(files[0]);
	}, []);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: { "image/*": [] },
		multiple: false,
	});

	const upload = useMutation({
		mutationFn: (formData: FormData) => uploadImage({ data: formData }),
		onSuccess: (img) => {
			toast.success("Uploaded");
			queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
			queryClient.invalidateQueries({ queryKey: queryKeys.stats });
			router.navigate({ to: "/images/$imageId", params: { imageId: img.id } });
		},
		onError: (err: Error) => toast.error(err.message),
	});

	function handleSubmit(e: React.SubmitEvent) {
		e.preventDefault();
		setMetaError(null);

		if (mode === "file" && !file) {
			toast.error("Please choose a file");
			return;
		}
		if (mode === "url" && !url.trim()) {
			toast.error("Please enter a URL");
			return;
		}

		const metaCheck = validateMeta(meta);
		if (!metaCheck.ok) {
			setMetaError(metaCheck.error);
			return;
		}

		upload.mutate(
			buildUploadFormData({
				mode,
				file,
				url,
				customId,
				creator,
				clientId,
				folderId,
				meta,
				signed,
			}),
		);
	}

	return (
		<>
			<PageHeader
				title="Upload Image"
				description="Upload a file or import from a URL into Cloudflare Images."
			/>

			<form
				onSubmit={handleSubmit}
				className="grid gap-6 lg:grid-cols-[1fr_360px]"
			>
				<div>
					<Tabs
						value={mode}
						onValueChange={(v) => setMode(v as "file" | "url")}
						className="flex flex-col w-full"
					>
						<TabsList className="w-full">
							<TabsTrigger value="file" className="p-4">
								Upload File
							</TabsTrigger>
							<TabsTrigger value="url" className="p-4">
								From URL
							</TabsTrigger>
						</TabsList>

						<TabsContent value="file">
							<Card>
								<CardContent className="p-4">
									<div
										{...getRootProps()}
										className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-12 text-center transition ${
											isDragActive
												? "border-primary bg-accent"
												: "border-border hover:bg-accent/50"
										}`}
									>
										<input {...getInputProps()} />
										<CloudArrowUpIcon className="size-10 text-muted-foreground" />
										<p className="mt-3 font-medium">
											{isDragActive
												? "Drop the image here…"
												: "Drag and drop an image, or click to browse"}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											Max 10 MB · jpg, png, gif, webp, svg
										</p>
									</div>

									{file ? (
										<div className="mt-4 flex items-center gap-3 rounded-md border p-3">
											<ImageIcon className="size-5 text-muted-foreground" />
											<div className="flex-1 truncate">
												<p className="truncate text-sm font-medium">
													{file.name}
												</p>
												<p className="text-xs text-muted-foreground">
													{formatBytes(file.size)}
												</p>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												onClick={() => setFile(null)}
											>
												<XIcon />
											</Button>
										</div>
									) : null}
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="url">
							<Card>
								<CardContent className="space-y-2 p-4">
									<Label htmlFor="url">Image URL</Label>
									<Input
										id="url"
										type="url"
										placeholder="https://example.com/photo.jpg"
										value={url}
										onChange={(e) => setUrl(e.target.value)}
									/>
									<p className="text-xs text-muted-foreground">
										Cloudflare will fetch the URL and store the image.
									</p>
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>

					<Card className="mt-4">
						<CardContent className="space-y-2 p-4">
							<Label htmlFor="meta">Metadata (JSON object, ≤ 1024 bytes)</Label>
							<Textarea
								id="meta"
								value={meta}
								onChange={(e) => setMeta(e.target.value)}
								placeholder={'{ "alt": "...", "tags": ["..."] }'}
								rows={6}
								className="font-mono text-xs"
								spellCheck={false}
							/>
							{metaError ? (
								<p className="text-xs text-destructive">{metaError}</p>
							) : null}
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardContent className="space-y-4 p-4">
						<div>
							<Label htmlFor="customId" className="mb-1">
								Custom ID (optional)
							</Label>
							<Input
								id="customId"
								value={customId}
								onChange={(e) => setCustomId(e.target.value)}
								placeholder="Auto-generated if empty"
							/>
						</div>
						<div>
							<Label htmlFor="creator" className="mb-1">
								Creator (optional)
							</Label>
							<Input
								id="creator"
								value={creator}
								onChange={(e) => setCreator(e.target.value)}
							/>
						</div>
						<ClientFolderFields
							clientId={clientId}
							folderId={folderId}
							onClientChange={setClientId}
							onFolderChange={setFolderId}
						/>
						<div className="flex items-center gap-2">
							<Switch
								id="signed"
								checked={signed}
								onCheckedChange={setSigned}
							/>
							<Label htmlFor="signed">Require signed URLs</Label>
						</div>
						<Button
							type="submit"
							className="w-full"
							disabled={upload.isPending}
						>
							{upload.isPending ? "Uploading…" : "Upload"}
						</Button>
					</CardContent>
				</Card>
			</form>
		</>
	);
}
