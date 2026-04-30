import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
	value,
	label,
	className,
	size = "icon",
}: {
	value: string;
	label?: string;
	className?: string;
	size?: "icon" | "sm" | "default";
}) {
	const [copied, setCopied] = useState(false);

	function handleCopy() {
		navigator.clipboard.writeText(value).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}

	return (
		<Button
			type="button"
			variant="outline"
			size={size}
			className={cn(className)}
			onClick={handleCopy}
			aria-label={label ?? "Copy"}
		>
			{copied ? <CheckIcon /> : <CopyIcon />}
			{size !== "icon" && label ? <span className="ml-2">{label}</span> : null}
		</Button>
	);
}
