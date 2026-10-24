import { Button } from "../ui/button";

export type LoadErrorKind =
	| { kind: "limited"; retryAfter?: number }
	| { kind: "gone" }
	| { kind: "not-found" }
	| { kind: "transient" };

export function EventLoadError({
	action,
	error,
}: {
	action:
		| { label: string; onClick?: () => void }
		| { label: string; href: string };
	error: LoadErrorKind;
}) {
	const title =
		error.kind === "limited"
			? "Slow down — too many requests"
			: error.kind === "gone"
				? "This event has expired"
				: error.kind === "transient"
					? "Could not load this event"
					: "Event not found";
	const copy =
		error.kind === "limited"
			? error.retryAfter !== undefined
				? `Wait about ${error.retryAfter} seconds, then try again.`
				: "Wait a moment, then try again."
			: error.kind === "gone"
				? "Events are deleted after they pass to free up space."
				: error.kind === "transient"
					? "The server hiccuped. Your link is fine — try again."
					: "Check the link and try again.";
	return (
		<div className="mx-auto w-[min(1080px,calc(100%-2rem))] py-16 text-center">
			<h1 className="font-heading text-3xl font-bold" tabIndex={-1}>
				{title}
			</h1>
			<p className="mt-2 text-muted-foreground">{copy}</p>
			{"href" in action ? (
				<Button asChild className="mt-4">
					<a href={action.href}>{action.label}</a>
				</Button>
			) : (
				<Button className="mt-4" onClick={action.onClick} type="button">
					{action.label}
				</Button>
			)}
		</div>
	);
}
