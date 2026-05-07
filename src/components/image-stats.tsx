import { useSuspenseQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { statsQueryOptions } from "@/lib/queries";

export function ImageStats() {
	const { data: stats } = useSuspenseQuery(statsQueryOptions());
	const current = stats?.count?.current ?? 0;
	const allowed = stats?.count?.allowed ?? 0;
	const pct = allowed > 0 ? Math.min((current / allowed) * 100, 100) : 0;
	const pctDisplay = pct.toFixed(1);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Storage Usage</CardTitle>
				<CardDescription>
					{formatNumber(current)} / {formatNumber(allowed)} images
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-primary transition-all"
						style={{ width: `${pct}%` }}
					/>
				</div>
				<p className="mt-2 text-right text-xs text-muted-foreground">
					{pctDisplay}% of plan used
				</p>
			</CardContent>
		</Card>
	);
}
