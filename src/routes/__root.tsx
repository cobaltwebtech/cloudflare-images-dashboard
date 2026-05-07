import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { configQueryOptions } from "@/lib/queries";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Cloudflare Images Dashboard" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.svg" },
		],
	}),
	// Preload the public CF config on every navigation — it's tiny, nearly
	// static, and used by every route to build delivery URLs. Shipping it
	// in the SSR HTML payload removes a client-side waterfall on first load.
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(configQueryOptions()),
	notFoundComponent: NotFound,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider defaultTheme="system" storageKey="theme">
					<TooltipProvider delayDuration={300}>
						<SidebarProvider>
							<AppSidebar />
							<SidebarInset>
								<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
									<SidebarTrigger className="-ml-1" />
									<Separator orientation="vertical" className="mr-2 h-4" />
									<h1 className="text-sm font-medium text-muted-foreground">
										Cloudflare Images
									</h1>
									<div className="ml-auto flex items-center gap-2">
										<Badge variant="outline">v{__APP_VERSION__}</Badge>
										<Badge variant="outline">{__APP_COMMIT__}</Badge>
										<ModeToggle />
									</div>
								</header>
								<main className="flex-1 p-6 space-y-6">
									{children ?? <Outlet />}
								</main>
							</SidebarInset>
						</SidebarProvider>
					</TooltipProvider>
					<Toaster />
				</ThemeProvider>
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
