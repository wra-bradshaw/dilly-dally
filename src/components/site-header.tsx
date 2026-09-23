import { Button } from "#/components/ui/button";

export function SiteHeader() {
	return (
		<header className="flex items-center justify-between py-5">
			<a className="font-heading text-2xl font-bold" href="/">
				dilly dally
			</a>
			<nav aria-label="Site" className="flex items-center gap-1 text-sm">
				<Button asChild size="sm" variant="link">
					<a href="/api/agent-guide">Agent guide</a>
				</Button>
				<Button asChild size="sm" variant="link">
					<a href="/api/openapi.json">OpenAPI</a>
				</Button>
			</nav>
		</header>
	);
}
