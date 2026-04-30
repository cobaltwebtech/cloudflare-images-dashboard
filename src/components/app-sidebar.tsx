import {
	ArrowSquareOutIcon,
	ImageIcon,
	KeyIcon,
	ResizeIcon,
	SquaresFourIcon,
	StackIcon,
	UploadSimpleIcon,
	UsersThreeIcon,
} from "@phosphor-icons/react";
import { Link, useLocation } from "@tanstack/react-router";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";

type NavItem = {
	title: string;
	to: string;
	icon: React.ReactNode;
	exact?: boolean;
};

const NAV_PRIMARY: Array<NavItem> = [
	{ title: "Dashboard", to: "/", icon: <SquaresFourIcon />, exact: true },
	{ title: "Upload", to: "/upload", icon: <UploadSimpleIcon /> },
	{ title: "Images", to: "/images", icon: <ImageIcon /> },
	{ title: "Folders", to: "/folders", icon: <StackIcon /> },
	{ title: "Clients", to: "/clients", icon: <UsersThreeIcon /> },
];

const NAV_SETTINGS: Array<NavItem> = [
	{ title: "Variants", to: "/variants", icon: <ResizeIcon /> },
	{ title: "Signing Keys", to: "/signing-keys", icon: <KeyIcon /> },
];

function isActive(pathname: string, item: NavItem): boolean {
	if (item.exact) return pathname === item.to;
	return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavSection({
	label,
	items,
}: {
	label: string;
	items: Array<NavItem>;
}) {
	const { pathname } = useLocation();
	return (
		<SidebarGroup>
			<SidebarGroupLabel>{label}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={item.to}>
						<SidebarMenuButton
							asChild
							tooltip={item.title}
							isActive={isActive(pathname, item)}
						>
							<Link to={item.to}>
								{item.icon}
								<span>{item.title}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/">
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
									<ImageIcon className="size-4" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium">CF Images</span>
									<span className="truncate text-xs">Dashboard</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavSection label="Library" items={NAV_PRIMARY} />
				<NavSection label="Settings" items={NAV_SETTINGS} />
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild tooltip="Cloudflare dashboard">
							<a
								href="https://dash.cloudflare.com/?to=/:account/images"
								target="_blank"
								rel="noreferrer noopener"
							>
								<ArrowSquareOutIcon />
								<span>CF Dashboard</span>
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
