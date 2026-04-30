import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

/**
 * Standard Cancel / primary-action footer used by the form dialogs.
 * Keeps the trailing button shape (label, disabled, click) consistent.
 */
export function DialogActionFooter({
	onCancel,
	onSubmit,
	submitLabel,
	disabled,
}: {
	onCancel: () => void;
	onSubmit: () => void;
	submitLabel: string;
	disabled?: boolean;
}) {
	return (
		<DialogFooter>
			<Button variant="outline" onClick={onCancel}>
				Cancel
			</Button>
			<Button disabled={disabled} onClick={onSubmit}>
				{submitLabel}
			</Button>
		</DialogFooter>
	);
}
