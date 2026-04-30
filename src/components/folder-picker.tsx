import { useQuery } from "@tanstack/react-query";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { foldersQueryOptions } from "@/lib/queries";

const ALL = "__all__";
const ROOT = "__root__";

/**
 * Folder picker. `value === null` = "root", `value === undefined` = "all".
 * Excludes any folder ids in `excludeIds` (used by Move dialog to hide self/descendants).
 */
// Tri-state picker (all/root/specific id) inherently branches on value mapping;
// extracting helpers wouldn't reduce the cyclomatic count meaningfully.
// fallow-ignore-next-line complexity
export function FolderPicker({
	value,
	onChange,
	includeAll = false,
	includeRoot = true,
	excludeIds,
	placeholder = "Select folder",
	className,
}: {
	value: string | null | undefined;
	onChange: (id: string | null | undefined) => void;
	includeAll?: boolean;
	includeRoot?: boolean;
	excludeIds?: Array<string>;
	placeholder?: string;
	className?: string;
}) {
	const { data: folders = [] } = useQuery(foldersQueryOptions());

	const filtered = excludeIds?.length
		? folders.filter((f) => !excludeIds.includes(f.id))
		: folders;

	const selectValue = value === undefined ? ALL : value === null ? ROOT : value;

	return (
		<Select
			value={selectValue}
			onValueChange={(v) => {
				if (v === ALL) onChange(undefined);
				else if (v === ROOT) onChange(null);
				else onChange(v);
			}}
		>
			<SelectTrigger className={className}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{includeAll ? <SelectItem value={ALL}>All folders</SelectItem> : null}
				{includeRoot ? <SelectItem value={ROOT}>/ (root)</SelectItem> : null}
				{filtered.map((f) => (
					<SelectItem key={f.id} value={f.id}>
						{f.path}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
