import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AvailabilityGrid } from "#/components/availability-grid";
import { buildColumns, buildWeeklyColumns } from "#/components/grid-model";
import { GroupHeatmap, heatmapAnnounce } from "#/components/group-heatmap";
import { ThemeToggle } from "#/components/theme-toggle";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { useCopyToClipboard } from "#/hooks/use-copy-to-clipboard";
import { useEventDetail } from "#/hooks/use-event-detail";
import { useLocalStorage } from "#/hooks/use-local-storage";
import { useOwnAvailabilityRestore } from "#/hooks/use-own-availability-restore";
import { useSerialSaver } from "#/hooks/use-serial-saver";
import {
	type EventDetailResponse,
	fetchOwnAvailability,
	saveAvailability,
} from "#/lib/client";
import { patchDetailForSave } from "#/lib/detail-patch";
import { fetchEventDetailServerFn } from "#/lib/event-detail-loader";
import { decideSignInError, saveErrorMessage } from "#/lib/event-messages";
import { HttpError } from "#/lib/http-error";
import { allTimezones, browserTimezone } from "#/lib/time-slots";

export const Route = createFileRoute("/e/$eventId")({
	component: EventPage,
	errorComponent: EventError,
	headers: () => ({
		"Cache-Control": "no-store",
	}),
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData({
			queryFn: async () => {
				const result = await fetchEventDetailServerFn({
					data: params.eventId,
				});
				if (!result.ok) {
					throw new HttpError(
						result.status,
						result.code,
						result.message,
						undefined,
						result.retryAfter,
					);
				}
				return result.detail;
			},
			queryKey: ["event", params.eventId],
		});
	},
});

function EventError({ error }: { error: unknown }) {
	const gone = error instanceof HttpError && error.code === "gone";
	const limited = !gone && error instanceof HttpError && error.status === 429;
	const retryAfter =
		limited && error instanceof HttpError ? error.retryAfter : undefined;
	return (
		<div className="mx-auto w-[min(1080px,calc(100%-2rem))] py-16 text-center">
			<h1 className="font-heading text-3xl font-bold">
				{limited
					? "Slow down — too many requests"
					: gone
						? "This event has expired"
						: "Event not found"}
			</h1>
			<p className="mt-2 text-muted-foreground">
				{limited
					? retryAfter
						? `Wait about ${retryAfter} seconds, then try again.`
						: "Wait a moment, then try again."
					: gone
						? "Events are deleted after they pass to free up space."
						: "Check the link and try again."}
			</p>
			{limited ? (
				<Button
					className="mt-4"
					onClick={() => window.location.reload()}
					type="button"
				>
					Retry
				</Button>
			) : (
				<Button asChild className="mt-4">
					<a href="/">Plan a new event</a>
				</Button>
			)}
		</div>
	);
}

function inviteUrl(eventId: string): string {
	if (typeof window === "undefined") return `/e/${eventId}`;
	return `${window.location.origin}/e/${eventId}`;
}

function EventPage() {
	const { eventId } = Route.useParams();
	const detail = useEventDetail(eventId);
	const queryClient = useQueryClient();
	const { copied, copy, copyError } = useCopyToClipboard();
	const [storedName, setStoredName] = useLocalStorage(`dd:${eventId}:name`, "");
	const [name, setName] = useState(storedName);
	const [password, setPassword] = useState("");
	const [activeName, setActiveName] = useState(storedName.trim());
	const [signedIn, setSignedIn] = useState(storedName.trim() !== "");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [saveState, setSaveState] = useState("");
	const [signError, setSignError] = useState("");
	const [signing, setSigning] = useState(false);
	const lastSavedRef = useRef<Set<string>>(new Set());
	const lastSubmittedRef = useRef<{
		password: string | undefined;
		identity: string;
		slots: Set<string>;
	} | null>(null);
	const { retry: retryRestore, status: restoreStatus } =
		useOwnAvailabilityRestore({
			eventId,
			eventSettled: !detail.isPending,
			fetchAvailability: fetchOwnAvailability,
			onCleared: () => {
				lastSavedRef.current = new Set();
				setSelected(new Set());
			},
			onNeedsPassword: (name) => {
				setName(name);
				setSignedIn(false);
				setSignError("Enter your password to continue.");
			},
			onRestored: (own) => {
				lastSavedRef.current = new Set(own.slots);
				setSelected(new Set(own.slots));
				setActiveName(own.name);
				setStoredName(own.name);
				setName(own.name);
				setSignedIn(true);
			},
			storedName,
		});
	const [view, setView] = useLocalStorage("dd:tz-view", "");

	const event = detail.data?.event;
	const browserTz = browserTimezone();
	const eventTz = event?.timezone ?? "UTC";
	const zones = useMemo(() => allTimezones(), []);
	const viewTimezone =
		view !== "" && view !== "event" && view !== "local" && zones.includes(view)
			? view
			: view === "local"
				? browserTz
				: eventTz;
	const zoneOptions = useMemo(() => {
		const rest = zones.filter((z) => z !== eventTz && z !== browserTz);
		return [
			{ label: `${eventTz} (event time)`, value: eventTz },
			...(browserTz === eventTz
				? []
				: [{ label: `${browserTz} (your time)`, value: browserTz }]),
			...rest.map((z) => ({ label: z, value: z })),
		];
	}, [zones, eventTz, browserTz]);

	const columns = useMemo(() => {
		if (!detail.data) return [];
		if ((detail.data.event.mode ?? "dates") === "weekly") {
			return buildWeeklyColumns(detail.data.slotUniverse);
		}
		return buildColumns(
			detail.data.slotUniverse,
			detail.data.event.timezone,
			viewTimezone,
		);
	}, [detail.data, viewTimezone]);
	const counts = useMemo(() => {
		const map = new Map<string, { count: number; names: string[] }>();
		for (const c of detail.data?.counts ?? []) map.set(c.slot, c);
		return map;
	}, [detail.data]);
	const allNames = useMemo(
		() => detail.data?.participants.map((p) => p.name) ?? [],
		[detail.data],
	);

	const signIn = async () => {
		setSignError("");
		if (!name.trim()) {
			setSignError("Enter your name to continue.");
			return;
		}
		if (password !== "" && password.length < 4) {
			setSignError("Password must be at least 4 characters.");
			return;
		}
		setSigning(true);
		try {
			const own = await fetchOwnAvailability(
				eventId,
				name.trim(),
				password === "" ? undefined : password,
			);
			lastSavedRef.current = new Set(own.slots);
			setSelected(new Set(own.slots));
			setActiveName(own.name);
			setStoredName(own.name);
		} catch (err) {
			const decision = decideSignInError(err);
			if (decision.kind === "message") {
				setSignError(decision.text);
				return;
			}
			lastSavedRef.current = new Set();
			setSelected(new Set());
			setActiveName(name.trim());
			setStoredName(name.trim());
		} finally {
			setSigning(false);
		}
		setSignedIn(true);
	};

	const saver = useSerialSaver<{
		password: string | undefined;
		identity: string;
		slots: Set<string>;
	}>({
		onError: (err, value) => {
			if (value === lastSubmittedRef.current) {
				setSelected(new Set(lastSavedRef.current));
			}
			setSaveState(saveErrorMessage(err));
		},
		onSuccess: (value) => {
			lastSavedRef.current = new Set(value.slots);
			if (value === lastSubmittedRef.current) {
				setSelected(new Set(value.slots));
			}
			const at = new Date();
			setSaveState(`Saved ${at.toLocaleTimeString()}`);
			if (value.identity.trim() !== "") {
				const stamp = at.toISOString();
				queryClient.setQueryData(
					["event", eventId],
					(old: EventDetailResponse | undefined) =>
						old
							? patchDetailForSave(old, value.identity, value.slots, stamp)
							: old,
				);
			}
		},
		save: async (value) => {
			await saveAvailability(eventId, {
				name: value.identity,
				password: value.password,
				slots: [...value.slots],
			});
		},
	});

	const commit = (next: Set<string>) => {
		setSelected(next);
		if (!signedIn || activeName === "") return;
		setSaveState("Saving…");
		const tagged = {
			identity: activeName,
			password: password === "" ? undefined : password,
			slots: next,
		};
		lastSubmittedRef.current = tagged;
		saver.submit(tagged);
	};

	if (detail.isPending) {
		return (
			<div className="mx-auto w-[min(1080px,calc(100%-2rem))] py-16">
				<p className="text-muted-foreground">Loading event…</p>
			</div>
		);
	}

	if (detail.isError && !detail.data) {
		const err = detail.error;
		const gone = err instanceof HttpError && err.code === "gone";
		const retryable =
			!(err instanceof HttpError) || err.status === 429 || err.status >= 500;
		if (retryable && !gone) {
			return (
				<div className="mx-auto w-[min(1080px,calc(100%-2rem))] py-16 text-center">
					<h1 className="font-heading text-3xl font-bold">
						Could not load this event
					</h1>
					<p className="mt-2 text-muted-foreground">
						The server hiccuped. Your link is fine — try again.
					</p>
					<Button
						className="mt-4"
						onClick={() => void detail.refetch()}
						type="button"
					>
						Retry
					</Button>
				</div>
			);
		}
		return (
			<div className="mx-auto w-[min(1080px,calc(100%-2rem))] py-16 text-center">
				<h1 className="font-heading text-3xl font-bold">
					{gone ? "This event has expired" : "Event not found"}
				</h1>
				<p className="mt-2 text-muted-foreground">
					{gone
						? "Events are deleted after they pass to free up space."
						: "Check the link and try again."}
				</p>
				<Button asChild className="mt-4">
					<a href="/">Plan a new event</a>
				</Button>
			</div>
		);
	}

	const total = allNames.length;
	const url = inviteUrl(eventId);
	const stale = detail.isError && detail.data !== undefined;

	return (
		<div className="mx-auto w-[min(1080px,calc(100%-2rem))] animate-in fade-in slide-in-from-bottom-3 duration-700 pb-16">
			{stale && (
				<output className="mt-4 block rounded-xl border border-input bg-card px-3 py-2 text-center text-sm text-muted-foreground">
					Couldn&apos;t refresh — showing the last update.{" "}
					<Button
						className="h-auto p-0 text-sm"
						onClick={() => void detail.refetch()}
						type="button"
						variant="link"
					>
						Retry
					</Button>
				</output>
			)}
			<header className="flex items-center justify-between py-5">
				<a className="font-heading text-2xl font-bold" href="/">
					dilly dally
				</a>
				<nav className="flex items-center gap-1 text-sm">
					<Button asChild size="sm" variant="ghost">
						<a href="/api/agent-guide">Agent guide</a>
					</Button>
					<ThemeToggle />
				</nav>
			</header>

			<h1 className="font-heading mt-2 text-3xl font-bold">{event?.title}</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				{event?.timezone} ·{" "}
				<Tooltip open={copied ? true : undefined}>
					<TooltipTrigger asChild>
						<a
							className="text-primary underline underline-offset-4 hover:text-accent-foreground"
							href={url}
							onClick={(e) => {
								e.preventDefault();
								copy(url);
							}}
							suppressHydrationWarning
						>
							{url}
						</a>
					</TooltipTrigger>
					<TooltipContent>
						{copyError
							? "Copy failed — long-press the link to copy it manually"
							: copied
								? "Copied!"
								: "Click to copy invite link"}
					</TooltipContent>
				</Tooltip>
				<span aria-live="polite" className="sr-only">
					{copied ? "Invite link copied to clipboard" : ""}
				</span>
			</p>

			{!signedIn ? (
				<Card className="mt-4">
					<CardHeader>
						<CardTitle>Sign in</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="mb-4 text-sm text-muted-foreground">
							Your name and password are only for this event. New here? Make up
							a password. Returning? Use the same name and password.
						</p>
						<form
							className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
							onSubmit={(e) => {
								e.preventDefault();
								void signIn();
							}}
						>
							<div className="grid gap-2">
								<Label htmlFor="who-name">Your name</Label>
								<Input
									autoComplete="username"
									id="who-name"
									maxLength={40}
									onChange={(e) => setName(e.target.value)}
									placeholder="Ada Lovelace"
									value={name}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="who-pass">Password (optional)</Label>
								<Input
									autoComplete="current-password"
									id="who-pass"
									onChange={(e) => setPassword(e.target.value)}
									type="password"
									value={password}
								/>
							</div>
							<Button disabled={signing} type="submit">
								{signing ? "Signing in…" : "Continue"}
							</Button>
						</form>
						{signError !== "" && (
							<p className="mt-2 text-sm text-destructive" role="alert">
								{signError}
							</p>
						)}
					</CardContent>
				</Card>
			) : (
				<div className="mt-4 flex items-center gap-3 text-sm">
					<span>
						Signed in as <strong>{activeName}</strong>
					</span>
					<Button
						className="h-auto p-0 text-sm"
						onClick={() => {
							saver.cancel();
							lastSubmittedRef.current = null;
							setSignedIn(false);
							setPassword("");
							setSelected(new Set());
							setActiveName("");
							setStoredName("");
							setName("");
							setSaveState("");
							setSignError("");
						}}
						type="button"
						variant="link"
					>
						Switch user
					</Button>
				</div>
			)}

				<div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
					<Label htmlFor="tz-view">Show times in</Label>
					<Select onValueChange={setView} value={viewTimezone}>
						<SelectTrigger className="w-80" id="tz-view" type="button">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{zoneOptions.map((z) => (
								<SelectItem key={z.value} value={z.value}>
									{z.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

			<Card className="mt-4">
				<CardHeader>
					<CardTitle>
						Your availability{" "}
						<span
							aria-live="polite"
							className="text-xs font-normal text-muted-foreground"
						>
							{saveState}
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p
						aria-live="polite"
						className={
							restoreStatus === "restoring" || restoreStatus === "failed"
								? "mb-2 text-sm text-muted-foreground"
								: "sr-only"
						}
					>
						{restoreStatus === "restoring" ? (
							"Restoring…"
						) : restoreStatus === "failed" ? (
							<>
								Could not restore your availability.{" "}
								<Button
									className="h-auto p-0 text-sm"
									onClick={retryRestore}
									type="button"
									variant="link"
								>
									Retry
								</Button>
							</>
						) : (
							""
						)}
					</p>
					{!signedIn ? (
						<p className="text-sm text-muted-foreground">
							Sign in above, then click and drag to paint the times you are
							free.
						</p>
					) : (
						<>
							{restoreStatus === "gone" && (
								<p className="mb-2 text-sm text-muted-foreground" role="alert">
									This event has expired. Reload the page.
								</p>
							)}
							<AvailabilityGrid
								columns={columns}
								disabled={
									restoreStatus === "restoring" ||
									restoreStatus === "failed" ||
									restoreStatus === "gone"
								}
								onCommit={commit}
								selected={selected}
							/>
						</>
					)}
				</CardContent>
			</Card>

				<Card className="mt-4">
					<CardHeader>
						<CardTitle>Group&apos;s availability</CardTitle>
					</CardHeader>
					<CardContent>
						<GroupHeatmap
							allNames={allNames}
							announce={heatmapAnnounce(signedIn)}
							columns={columns}
							counts={counts}
							eventTimezone={event?.timezone}
							total={total}
							viewTimezone={viewTimezone}
						/>
					</CardContent>
				</Card>

			<footer className="mt-8 text-center text-xs text-muted-foreground">
				The link is the event, keep it. Data auto-deletes after the event
				passes. Agents: see{" "}
				<a
					className="text-primary underline-offset-4 hover:underline"
					href="/api/agent-guide"
				>
					/api/agent-guide
				</a>{" "}
				and{" "}
				<a
					className="text-primary underline-offset-4 hover:underline"
					href="/api/openapi.json"
				>
					/api/openapi.json
				</a>
				.
			</footer>
		</div>
	);
}
