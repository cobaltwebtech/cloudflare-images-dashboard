import { ClientPicker } from "@/components/client-picker";
import { FolderPicker } from "@/components/folder-picker";
import { Label } from "@/components/ui/label";

/**
 * Paired Client + Folder pickers used on the upload form and image detail page.
 * Both values are nullable; `null` means "no client / root folder".
 */
export function ClientFolderFields({
	clientId,
	folderId,
	onClientChange,
	onFolderChange,
}: {
	clientId: string | null;
	folderId: string | null;
	onClientChange: (v: string | null) => void;
	onFolderChange: (v: string | null) => void;
}) {
	return (
		<>
			<div>
				<Label className="mb-1">Client</Label>
				<ClientPicker
					value={clientId}
					onChange={(v) => onClientChange(v ?? null)}
					includeAll={false}
				/>
			</div>
			<div>
				<Label className="mb-1">Folder</Label>
				<FolderPicker
					value={folderId}
					onChange={(v) => onFolderChange(v ?? null)}
					includeAll={false}
				/>
			</div>
		</>
	);
}
