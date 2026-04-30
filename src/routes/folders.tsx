import {
	ArrowsOutLineVerticalIcon,
	CaretDownIcon,
	CaretRightIcon,
	FolderIcon,
	FolderPlusIcon,
	PencilSimpleIcon,
	StackIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DialogActionFooter } from "@/components/dialog-action-footer";
import { EmptyState } from "@/components/empty-state";
import { FolderPicker } from "@/components/folder-picker";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Folder } from "@/db/db-schema";
import {
	folderCountsQueryOptions,
	foldersQueryOptions,
	queryKeys,
} from "@/lib/queries";
import {
	createFolder,
	deleteFolder,
	moveFolder,
	renameFolder,
} from "@/server/folders";

export const Route = createFileRoute("/folders")({ component: FoldersPage });

type TreeNode = Folder & { children: Array<TreeNode> };

function buildTree(folders: Array<Folder>): Array<TreeNode> {
	const nodes = new Map<string, TreeNode>();
	for (const f of folders) nodes.set(f.id, { ...f, children: [] });
	const roots: Array<TreeNode> = [];
	for (const node of nodes.values()) {
		if (node.parentId) {
			const parent = nodes.get(node.parentId);
			if (parent) parent.children.push(node);
			else roots.push(node);
		} else {
			roots.push(node);
		}
	}
	return roots;
}

function FoldersPage() {
	const queryClient = useQueryClient();
	const folders = useQuery(foldersQueryOptions());
	const counts = useQuery(folderCountsQueryOptions());

	const tree = useMemo(() => buildTree(folders.data ?? []), [folders.data]);
	const imageCountByFolder = useMemo(() => {
		const map = new Map<string, number>();
		for (const c of counts.data?.imageCounts ?? []) {
			if (c.folderId) map.set(c.folderId, c.count);
		}
		return map;
	}, [counts.data]);

	function refresh() {
		queryClient.invalidateQueries({ queryKey: queryKeys.folders.all });
		queryClient.invalidateQueries({ queryKey: queryKeys.folders.counts });
		queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
	}

	return (
		<>
			<PageHeader
				title="Folders"
				description="Organize images into a hierarchical tree."
				actions={
					<NewFolderButton
						parentId={null}
						onSuccess={refresh}
						label="Add Folder"
					/>
				}
			/>

			{folders.isLoading ? (
				<Skeleton className="h-64 w-full" />
			) : tree.length === 0 ? (
				<EmptyState
					icon={<StackIcon className="size-10" />}
					title="No folders yet"
					description="Create your first folder to start organizing images."
					action={
						<NewFolderButton
							parentId={null}
							onSuccess={refresh}
							label="New folder"
						/>
					}
				/>
			) : (
				<Card>
					<CardContent className="p-2">
						<ul className="space-y-1">
							{tree.map((node) => (
								<FolderNode
									key={node.id}
									node={node}
									depth={0}
									imageCountByFolder={imageCountByFolder}
									onChange={refresh}
								/>
							))}
						</ul>
					</CardContent>
				</Card>
			)}
		</>
	);
}

function FolderRowChevron({
	hasChildren,
	open,
	onToggle,
}: {
	hasChildren: boolean;
	open: boolean;
	onToggle: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-6"
			onClick={onToggle}
			disabled={!hasChildren}
		>
			{hasChildren ? open ? <CaretDownIcon /> : <CaretRightIcon /> : null}
		</Button>
	);
}

function FolderRowActions({
	folder,
	onChange,
}: {
	folder: TreeNode;
	onChange: () => void;
}) {
	return (
		<div className="ml-auto flex gap-4 opacity-0 transition group-hover:opacity-100">
			<MoveFolderButton folder={folder} onSuccess={onChange} />
			<NewFolderButton parentId={folder.id} onSuccess={onChange} compact />
			<RenameFolderButton folder={folder} onSuccess={onChange} />
			<DeleteFolderButton folder={folder} onSuccess={onChange} />
		</div>
	);
}

function FolderNode({
	node,
	depth,
	imageCountByFolder,
	onChange,
}: {
	node: TreeNode;
	depth: number;
	imageCountByFolder: Map<string, number>;
	onChange: () => void;
}) {
	const [open, setOpen] = useState(true);
	const hasChildren = node.children.length > 0;
	const imageCount = imageCountByFolder.get(node.id) ?? 0;
	const showChildren = hasChildren && open;

	return (
		<li>
			<div
				className="group flex items-center gap-2 px-2 py-1.5 hover:bg-accent"
				style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
			>
				<FolderRowChevron
					hasChildren={hasChildren}
					open={open}
					onToggle={() => setOpen((o) => !o)}
				/>
				<FolderIcon className="size-4 text-muted-foreground" />
				<span className="font-medium">{node.name}</span>
				{imageCount > 0 ? (
					<Badge variant="secondary" className="ml-2">
						{imageCount}
					</Badge>
				) : null}
				<FolderRowActions folder={node} onChange={onChange} />
			</div>
			{showChildren ? (
				<ul className="space-y-1">
					{node.children.map((child) => (
						<FolderNode
							key={child.id}
							node={child}
							depth={depth + 1}
							imageCountByFolder={imageCountByFolder}
							onChange={onChange}
						/>
					))}
				</ul>
			) : null}
		</li>
	);
}

function NewFolderButton({
	parentId,
	onSuccess,
	label,
	compact,
}: {
	parentId: string | null;
	onSuccess: () => void;
	label?: string;
	compact?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");

	const mutation = useMutation({
		mutationFn: createFolder,
		onSuccess: () => {
			toast.success("Folder created");
			setOpen(false);
			setName("");
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{compact ? (
					<Button variant="outline" size="icon" title="New subfolder">
						<FolderPlusIcon />
					</Button>
				) : (
					<Button>
						<FolderPlusIcon /> {label ?? "New folder"}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{parentId ? "New subfolder" : "New root folder"}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="folder-name">Name</Label>
					<Input
						id="folder-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="acme-logos"
						autoFocus
					/>
				</div>
				<DialogActionFooter
					onCancel={() => setOpen(false)}
					onSubmit={() =>
						mutation.mutate({ data: { name: name.trim(), parentId } })
					}
					submitLabel="Create"
					disabled={!name.trim() || mutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
}

function RenameFolderButton({
	folder,
	onSuccess,
}: {
	folder: Folder;
	onSuccess: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState(folder.name);

	const mutation = useMutation({
		mutationFn: renameFolder,
		onSuccess: () => {
			toast.success("Folder renamed");
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
				if (o) setName(folder.name);
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="icon" title="Rename">
					<PencilSimpleIcon />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename folder</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="rename-input">Name</Label>
					<Input
						id="rename-input"
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoFocus
					/>
				</div>
				<DialogActionFooter
					onCancel={() => setOpen(false)}
					onSubmit={() =>
						mutation.mutate({ data: { id: folder.id, name: name.trim() } })
					}
					submitLabel="Rename"
					disabled={!name.trim() || mutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
}

function MoveFolderButton({
	folder,
	onSuccess,
}: {
	folder: Folder;
	onSuccess: () => void;
}) {
	const [open, setOpen] = useState(false);
	const [parentId, setParentId] = useState<string | null>(folder.parentId);

	const mutation = useMutation({
		mutationFn: moveFolder,
		onSuccess: () => {
			toast.success("Folder moved");
			setOpen(false);
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="icon" title="Move">
					<ArrowsOutLineVerticalIcon />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Move "{folder.name}"</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<Label>New parent</Label>
					<FolderPicker
						value={parentId}
						onChange={(v) => setParentId(v ?? null)}
						includeAll={false}
						excludeIds={[folder.id]}
					/>
					<p className="text-xs text-muted-foreground">
						You cannot move a folder into itself or its descendants.
					</p>
				</div>
				<DialogActionFooter
					onCancel={() => setOpen(false)}
					onSubmit={() =>
						mutation.mutate({
							data: { id: folder.id, newParentId: parentId },
						})
					}
					submitLabel="Move"
					disabled={mutation.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
}

function DeleteFolderButton({
	folder,
	onSuccess,
}: {
	folder: Folder;
	onSuccess: () => void;
}) {
	const mutation = useMutation({
		mutationFn: deleteFolder,
		onSuccess: () => {
			toast.success("Folder deleted");
			onSuccess();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	return (
		<ConfirmDeleteButton
			title={`Delete "${folder.name}"?`}
			description="This deletes the folder and all subfolders. Images inside will be moved to root (no images are deleted)."
			isPending={mutation.isPending}
			onConfirm={() => mutation.mutate({ data: { id: folder.id } })}
		/>
	);
}
