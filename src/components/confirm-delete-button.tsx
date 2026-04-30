import { TrashIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
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
import { Button } from "@/components/ui/button";

/**
 * Ghost-icon trash button that opens an AlertDialog and calls `onConfirm`
 * when the user confirms. The mutation/loading state is owned by the caller.
 */
export function ConfirmDeleteButton({
	title,
	description,
	onConfirm,
	isPending,
	confirmLabel = "Delete",
	triggerTitle = "Delete",
}: {
	title: ReactNode;
	description: ReactNode;
	onConfirm: () => void;
	isPending?: boolean;
	confirmLabel?: string;
	triggerTitle?: string;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="ghost" size="icon" title={triggerTitle}>
					<TrashIcon />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction disabled={isPending} onClick={onConfirm}>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
