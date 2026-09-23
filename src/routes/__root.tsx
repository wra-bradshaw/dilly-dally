import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "next-themes";
import { SiteHeader } from "#/components/site-header";
import { Button } from "#/components/ui/button";
import { TooltipProvider } from "#/components/ui/tooltip";
import { useDocumentTitle } from "#/hooks/use-document-title";
import { useRouteFocus } from "#/hooks/use-route-focus";
import { fetchEventDetail } from "#/lib/client";
import { HttpError } from "#/lib/http-error";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "dilly dally",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	notFoundComponent: NotFoundPage,
	shellComponent: RootDocument,
});

export function routeTitle(
	pathname: string,
	eventTitle: string | undefined,
	eventError: unknown,
): string {
	if (pathname === "/") return "Plan a new event";
	if (pathname.startsWith("/e/")) {
		if (eventTitle) return eventTitle;
		if (eventError instanceof HttpError) {
			if (eventError.code === "gone") return "Event expired";
			if (eventError.status === 429) return "Too many requests";
			if (eventError.status === 404) return "Event not found";
		}
		if (eventError) return "Could not load event";
		return "Event details";
	}
	return "Page not found";
}

function RootComponent() {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const eventId = pathname.startsWith("/e/")
		? (pathname.split("/")[2] ?? "")
		: "";
	const detail = useQuery({
		enabled: eventId !== "",
		queryFn: () => fetchEventDetail(eventId),
		queryKey: ["event", eventId],
		retry: false,
		staleTime: 15_000,
	});
	useDocumentTitle(
		routeTitle(pathname, detail.data?.event.title, detail.error),
	);
	const settled = eventId === "" || !detail.isPending;
	useRouteFocus(settled ? `${pathname}#ready` : `${pathname}#loading`);
	return (
		<>
			<a
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:underline focus:ring-2 focus:ring-ring"
				href="#main"
			>
				Skip to main content
			</a>
			<main id="main">
				<Outlet />
			</main>
		</>
	);
}

function NotFoundPage() {
	useDocumentTitle("Page not found");
	return (
		<div className="mx-auto w-[min(1080px,calc(100%-2rem))] pb-16">
			<SiteHeader />
			<div className="py-16 text-center">
				<h1 className="font-heading text-3xl font-bold">Page not found</h1>
				<p className="mt-2 text-muted-foreground">
					Check the link and try again.
				</p>
				<Button asChild className="mt-4">
					<a href="/">Plan a new event</a>
				</Button>
			</div>
		</div>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					storageKey="dilly-dally-theme"
				>
					<TooltipProvider>{children}</TooltipProvider>
				</ThemeProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
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
