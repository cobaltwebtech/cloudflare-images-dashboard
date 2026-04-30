import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/client-picker";
import { DialogActionFooter } from "@/components/dialog-action-footer";
import { FolderPicker } from "@/components/folder-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatNumber } from "@/lib/format";
import { queryKeys } from "@/lib/queries";
import { bulkUpdateImages } from "@/server/images";

type FieldValue = string | null | undefined;

/**
 * Modal for applying a bulk edit to a set of selected image IDs.
 * Supports moving to a folder and/or (re)assigning a client. Each field is
 * gated by a checkbox so the user can change one, the other, or both.
 *
 * Renders only its `<Dialog>`; the trigger is owned by the parent so it can
 * live inside a selection toolbar.
 */
// Cyclomatic count comes from per-field gates and tri-state values.
// fallow-ignore-next-line complexity
export function BulkEdit({
	open,
	onOpenChange,
	selectedIds,
	onCompleted,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedIds: Array<string>;
	/** Called after a successful bulk update so the parent can clear selection. */
	onCompleted?: () => void;
}) {
	const queryClient = useQueryClient();

	const [changeFolder, setChangeFolder] = useState(false);
	// `undefined` = nothing chosen yet, `null` = root, otherwise folder id.
	const [folderId, setFolderId] = useState<FieldValue>(undefined);

	const [changeClient, setChangeClient] = useState(false);
	// `undefined` = nothing chosen yet, `null` = unassign, otherwise client id.
	const [clientId, setClientId] = useState<FieldValue>(undefined);

	// Reset choices each time the dialog opens.
	useEffect(() => {
		if (!open) return;
		setChangeFolder(false);
		setFolderId(undefined);
		setChangeClient(false);
		setClientId(undefined);
	}, [open]);

	const mutation = useMutation({
		mutationFn: (vars: {
			ids: Array<string>;
			folderId?: string | null;
			clientId?: string | null;
		}) => bulkUpdateImages({ data: vars }),
		onSuccess: (data) => {
			const parts: Array<string> = [];
			if (data.folderChanged) parts.push("folder");
			if (data.clientChanged) parts.push("client");
			toast.success(
				`Updated ${parts.join(" + ")} on ${formatNumber(data.updated)} ${
					data.updated === 1 ? "image" : "images"
				}`,
			);
			queryClient.invalidateQueries({ queryKey: queryKeys.images.all });
			if (data.folderChanged) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.folders.counts,
				});
			}
			onOpenChange(false);
			onCompleted?.();
		},
		onError: (err: Error) => toast.error(err.message),
	});

	const count = selectedIds.length;
	const folderReady = changeFolder && folderId !== undefined;
	const clientReady = changeClient && clientId !== undefined;
	const hasAnyChange = changeFolder || changeClient;
	const allChosen =
		(!changeFolder || folderReady) && (!changeClient || clientReady);
	const canSubmit =
		count > 0 && hasAnyChange && allChosen && !mutation.isPending;

	function handleSubmit() {
		if (!canSubmit) return;
		mutation.mutate({
			ids: selectedIds,
			...(changeFolder ? { folderId: folderId ?? null } : {}),
			...(changeClient ? { clientId: clientId ?? null } : {}),
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bulk edit images</DialogTitle>
					<DialogDescription>
						Apply changes to {formatNumber(count)} selected{" "}
						{count === 1 ? "image" : "images"}. Toggle each field you want to
						update.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<label
							htmlFor="bulk-change-folder"
							className="flex items-center gap-2 text-sm font-medium"
						>
							<Checkbox
								id="bulk-change-folder"
								checked={changeFolder}
								onCheckedChange={(v) => setChangeFolder(v === true)}
							/>
							Change folder
						</label>
						{changeFolder ? (
							<div className="pl-6">
								<Label className="mb-1 text-xs">Destination folder</Label>
								<FolderPicker
									value={folderId}
									onChange={setFolderId}
									includeAll={false}
									includeRoot
									placeholder="Select a folder…"
								/>
							</div>
						) : null}
					</div>

					<div className="space-y-2">
						<label
							htmlFor="bulk-change-client"
							className="flex items-center gap-2 text-sm font-medium"
						>
							<Checkbox
								id="bulk-change-client"
								checked={changeClient}
								onCheckedChange={(v) => setChangeClient(v === true)}
							/>
							Change client
						</label>
						{changeClient ? (
							<div className="pl-6">
								<Label className="mb-1 text-xs">Client</Label>
								<ClientPicker
									value={clientId}
									onChange={setClientId}
									includeAll={false}
									includeNone
									placeholder="Select a client…"
								/>
							</div>
						) : null}
					</div>
				</div>

				<DialogActionFooter
					onCancel={() => onOpenChange(false)}
					onSubmit={handleSubmit}
					submitLabel={mutation.isPending ? "Applying…" : "Apply"}
					disabled={!canSubmit}
				/>
			</DialogContent>
		</Dialog>
	);
}
