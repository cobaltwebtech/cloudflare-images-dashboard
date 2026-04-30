import {
	ArrowLeftIcon,
	HouseIcon,
	MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function NotFound() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<div className="flex max-w-md flex-col items-center text-center">
				<div className="mb-6 flex size-16 items-center justify-center rounded-full bg-muted">
					<MagnifyingGlassIcon className="size-8 text-muted-foreground" />
				</div>
				<p className="mb-2 text-sm font-medium text-muted-foreground">404</p>
				<h1 className="mb-2 text-2xl font-semibold tracking-tight">
					Page not found
				</h1>
				<p className="mb-6 text-sm text-muted-foreground">
					The page you're looking for doesn't exist or has been moved.
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => {
							window.history.back();
						}}
					>
						<ArrowLeftIcon /> Go back
					</Button>
					<Button asChild>
						<Link to="/">
							<HouseIcon /> Dashboard
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
