import {
	ImageIcon,
	KeyIcon,
	ResizeIcon,
	StackIcon,
	UploadSimpleIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Dashboard });

type NavTile = {
	title: string;
	to: string;
	description: string;
	icon: React.ReactNode;
};

const TILES: Array<NavTile> = [
	{
		title: "Upload",
		to: "/upload",
		description: "Add new images by file or URL.",
		icon: <UploadSimpleIcon className="size-6" />,
	},
	{
		title: "Images",
		to: "/images",
		description: "Browse, filter, and manage images in Cloudflare Images.",
		icon: <ImageIcon className="size-6" />,
	},
	{
		title: "Folders",
		to: "/folders",
		description: "Organize images into folders.",
		icon: <StackIcon className="size-6" />,
	},
	{
		title: "Clients",
		to: "/clients",
		description: "Group images by the customer they belong to.",
		icon: <UsersThreeIcon className="size-6" />,
	},
	{
		title: "Variants",
		to: "/variants",
		description: "Image variants used for transforming images on delivery.",
		icon: <ResizeIcon className="size-6" />,
	},
	{
		title: "Signing Keys",
		to: "/signing-keys",
		description: "Manage keys for signing URLs of private images.",
		icon: <KeyIcon className="size-6" />,
	},
];

function Dashboard() {
	return (
		<>
			<PageHeader
				title="Dashboard"
				description="Jump to a section of the Cloudflare Images dashboard."
			/>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{TILES.map((tile) => (
					<Link
						key={tile.to}
						to={tile.to}
						className="block transition hover:-translate-y-0.5"
					>
						<Card className="h-full transition hover:border-primary hover:shadow-md">
							<CardHeader className="flex flex-row items-start gap-4 space-y-0">
								<span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
									{tile.icon}
								</span>
								<div className="space-y-1">
									<CardTitle className="text-base">{tile.title}</CardTitle>
									<CardDescription>{tile.description}</CardDescription>
								</div>
							</CardHeader>
						</Card>
					</Link>
				))}
			</div>
		</>
	);
}
