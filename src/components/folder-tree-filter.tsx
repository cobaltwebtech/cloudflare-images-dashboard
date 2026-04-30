import { CaretRightIcon, FolderIcon, FoldersIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { Folder } from "@/db/db-schema";
import { foldersQueryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Tri-state folder filter rendered as a vertical list of buttons:
 *   - "All folders"   → value === undefined
 *   - "/ (root)"      → value === null
 *   - one button per folder, indented by hierarchy depth
 *
 * `folders` are already returned sorted by `path` (depth-first traversal),
 * so we don't need to recurse — the depth comes straight from the slash
 * count in `path` (e.g. `/a/b` is depth 2). This keeps the component O(n)
 * and trivial to read.
 */
export function FolderTreeFilter({
	value,
	onChange,
	className,
}: {
	value: string | null | undefined;
	onChange: (id: string | null | undefined) => void;
	className?: string;
}) {
	const { data: folders = [] } = useQuery(foldersQueryOptions());

	// Sort defensively in case the server order ever changes.
	const sorted = useMemo(
		() => [...folders].sort((a, b) => a.path.localeCompare(b.path)),
		[folders],
	);

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<TreeButton
				active={value === undefined}
				depth={0}
				icon={<FoldersIcon className="size-4" />}
				label="All folders"
				onClick={() => onChange(undefined)}
			/>
			<TreeButton
				active={value === null}
				depth={0}
				icon={<FolderIcon className="size-4" />}
				label="/ (root)"
				onClick={() => onChange(null)}
			/>
			{sorted.map((f) => (
				<TreeButton
					key={f.id}
					active={value === f.id}
					depth={depthOf(f)}
					icon={<FolderIcon className="size-4" />}
					label={f.name}
					onClick={() => onChange(f.id)}
				/>
			))}
		</div>
	);
}

/** `/a/b/c` → depth 3 (root-level folders are depth 1). */
function depthOf(f: Folder): number {
	// Path always starts with "/", so split length - 1 = segment count.
	return f.path.split("/").length - 1;
}

function TreeButton({
	active,
	depth,
	icon,
	label,
	onClick,
}: {
	active: boolean;
	depth: number;
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
}) {
	// Indent root-level entries (depth 0/1) flush; deeper folders get a
	// caret + extra padding per level. 1rem per level reads as a clear tree.
	const indent = Math.max(0, depth - 1);
	return (
		<Button
			type="button"
			variant={active ? "secondary" : "ghost"}
			size="sm"
			onClick={onClick}
			className="h-8 w-full justify-start gap-1.5 px-2 font-normal"
			style={{ paddingLeft: `${0.5 + indent * 1}rem` }}
		>
			{indent > 0 ? (
				<CaretRightIcon className="size-3 shrink-0 text-muted-foreground" />
			) : null}
			{icon}
			<span className="truncate">{label}</span>
		</Button>
	);
}
