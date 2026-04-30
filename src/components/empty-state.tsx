import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
	icon,
	title,
	description,
	action,
}: {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
				{icon ? <div className="text-muted-foreground">{icon}</div> : null}
				<div>
					<p className="font-medium">{title}</p>
					{description ? (
						<p className="mt-1 text-sm text-muted-foreground">{description}</p>
					) : null}
				</div>
				{action}
			</CardContent>
		</Card>
	);
}
