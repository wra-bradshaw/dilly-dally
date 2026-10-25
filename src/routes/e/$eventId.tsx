import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useMemo, useRef, useState } from "react";
import { AvailabilityGrid } from "#/components/availability-grid";
import { EventLoadError } from "#/components/event/event-load-error";
import { buildColumns } from "#/components/grid-model";
import { GroupHeatmap } from "#/components/group-heatmap";
import { PollsSection } from "#/components/polls";
import { Button } from "#/components/ui/button";
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
import { useEventSave } from "#/hooks/use-event-save";
import { useEventSignIn } from "#/hooks/use-event-sign-in";
import { useFocusOnSignal } from "#/hooks/use-focus-on-signal";
import { useHourCycle } from "#/hooks/use-hour-cycle";
import { useHydrateOnce } from "#/hooks/use-hydrate-once";
import { useLocalStorage } from "#/hooks/use-local-storage";
import { useOwnAvailabilityRestore } from "#/hooks/use-own-availability-restore";
import { useOwnSession } from "#/hooks/use-own-session";
import { deleteEventSession, fetchOwnAvailability } from "#/lib/client";
import {
	fetchEventDetailSsrFn,
	fetchInviteOriginSsrFn,
	fetchOwnSessionSsrFn,
} from "#/lib/event-ssr";
import { HttpError } from "#/lib/http-error";
import { inviteUrl } from "#/lib/invite-url";
import { allTimezones, browserTimezone } from "#/lib/time-slots";

export const Route = createFileRoute("/e/$eventId")({
	component: EventPage,
	errorComponent: EventError,
	headers: () => ({
		"Cache-Control": "no-store",
	}),
	loader: async ({ context, params }) => {
		const [, , origin] = await Promise.all([
			context.queryClient.ensureQueryData({
				queryFn: async () => {
					const result = await fetchEventDetailSsrFn({
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
				retry: false,
			}),
			context.queryClient.ensureQueryData({
				queryFn: async () => {
					const result = await fetchOwnSessionSsrFn({
						data: params.eventId,
					});
					return result;
				},
				queryKey: ["own-session", params.eventId],
				retry: false,
			}),
			fetchInviteOriginSsrFn().catch(() => ""),
		]);
		return { origin };
	},
});

function EventError({ error }: { error: unknown }) {
	const gone = error instanceof HttpError && error.code === "gone";
	const limited = !gone && error instanceof HttpError && error.status === 429;
	const retryAfter =
		limited && error instanceof HttpError ? error.retryAfter : undefined;
	if (limited) {
		return (
			<EventLoadError
				action={{ label: "Retry", onClick: () => window.location.reload() }}
				error={{ kind: "limited", retryAfter }}
			/>
		);
	}
	if (gone) {
		return (
			<EventLoadError
				action={{ href: "/", label: "Plan a new event" }}
				error={{ kind: "gone" }}
			/>
		);
	}
	return (
		<EventLoadError
			action={{ href: "/", label: "Plan a new event" }}
			error={{ kind: "not-found" }}
		/>
	);
}

function EventPage() {
	const { eventId } = Route.useParams();
	const { origin: ssrOrigin } = Route.useLoaderData();
	const detail = useEventDetail(eventId);
	const ownSession = useOwnSession(eventId);
	const sessionData = ownSession.data?.ok ? ownSession.data : null;
	const queryClient = useQueryClient();
	const { copied, copy, copyError } = useCopyToClipboard();
	const [copyUserOpen, setCopyUserOpen] = useState(false);
	const copyTooltip = {
		onOpenChange: setCopyUserOpen,
		open: copyUserOpen || copied || copyError,
	};
	const {
		copied: promptCopied,
		copy: copyPrompt,
		copyError: promptCopyError,
	} = useCopyToClipboard();
	const [promptUserOpen, setPromptUserOpen] = useState(false);
	const promptTooltip = {
		onOpenChange: setPromptUserOpen,
		open: promptUserOpen || promptCopied || promptCopyError,
	};
	const [storedName, setStoredName] = useLocalStorage(`dd:${eventId}:name`, "");
	const [name, setName] = useState(storedName);
	const [password, setPassword] = useState("");
	const [activeName, setActiveName] = useState(
		sessionData?.name ?? storedName.trim(),
	);
	const [signedIn, setSignedIn] = useState(
		sessionData !== null || storedName.trim() !== "",
	);
	const [selected, setSelected] = useState<Set<string>>(
		() => new Set(sessionData?.slots ?? []),
	);
	const lastSavedRef = useRef<Set<string>>(new Set(sessionData?.slots ?? []));
	const { saveFailed, saveState, commit, cancel, resetSave, lastSubmittedRef } =
		useEventSave({
			activeName,
			eventId,
			lastSavedRef,
			password,
			setSelected,
			signedIn,
		});
	const { signing, signError, setSignError, signIn } = useEventSignIn({
		eventId,
		invalidateOwnSession: () =>
			queryClient.invalidateQueries({ queryKey: ["own-session", eventId] }),
		lastSavedRef,
		name,
		password,
		setActiveName,
		setName,
		setPassword,
		setSelected,
		setSignedIn,
		setStoredName,
	});
	const signErrorId = useId();
	const signInTitleId = useId();
	const inviteHintId = useId();
	const copyStatusId = useId();
	const promptHintId = useId();
	const promptStatusId = useId();
	const restoreStatusId = useId();
	const tzLabelId = useId();
	const signErrorRef = useFocusOnSignal<HTMLParagraphElement>(signError);
	const signedInRef = useFocusOnSignal<HTMLHeadingElement>(signedIn);
	const restoreName = sessionData ? "" : storedName;
	const [hadStoredNameAtMount] = useState(() => storedName.trim() !== "");
	const hydrateSource =
		hadStoredNameAtMount &&
		sessionData !== null &&
		storedName.trim().toLowerCase() === sessionData.name.trim().toLowerCase()
			? sessionData
			: null;
	useHydrateOnce(hydrateSource, (arrived) => {
		lastSavedRef.current = new Set(arrived.slots);
		setSelected(new Set(arrived.slots));
		setActiveName(arrived.name);
		setStoredName(arrived.name);
		setSignedIn(true);
	});
	const { retry: retryRestore, status: restoreStatus } =
		useOwnAvailabilityRestore({
			eventId,
			eventSettled: !detail.isPending && !ownSession.isPending,
			fetchAvailability: fetchOwnAvailability,
			onCleared: () => {
				if (sessionData) return;
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
			storedName: restoreName,
		});
	const [view, setView] = useLocalStorage("dd:tz-view", "");
	const hourCycle = useHourCycle();

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
			return buildColumns(detail.data.slotUniverse, {
				hourCycle,
				mode: "weekly",
			});
		}
		return buildColumns(detail.data.slotUniverse, {
			eventTimezone: detail.data.event.timezone,
			hourCycle,
			mode: "dates",
			viewTimezone,
		});
	}, [detail.data, viewTimezone, hourCycle]);
	const counts = useMemo(() => {
		const map = new Map<string, { count: number; names: string[] }>();
		for (const c of detail.data?.counts ?? []) map.set(c.slot, c);
		return map;
	}, [detail.data]);
	const allNames = useMemo(
		() => detail.data?.participants.map((p) => p.name) ?? [],
		[detail.data],
	);

	if (detail.isPending) {
		return (
			<div className="mx-auto w-[min(1080px,calc(100%-2rem))] min-w-0 max-w-full py-16">
				<p aria-live="polite" className="text-muted-foreground">
					Loading event…
				</p>
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
				<EventLoadError
					action={{ label: "Retry", onClick: () => void detail.refetch() }}
					error={{ kind: "transient" }}
				/>
			);
		}
		return (
			<EventLoadError
				action={{ href: "/", label: "Plan a new event" }}
				error={gone ? { kind: "gone" } : { kind: "not-found" }}
			/>
		);
	}

	const total = allNames.length;
	const origin =
		ssrOrigin !== ""
			? ssrOrigin
			: typeof window !== "undefined"
				? window.location.origin
				: "";
	const url = inviteUrl(eventId, origin);
	const agentPrompt = `Fill in my availability using my calendar: ${url}\nFetch ${url} with header Accept: text/markdown for the machine-readable version.`;
	const stale = detail.isError && detail.data !== undefined;
	const gridDisabled =
		restoreStatus === "restoring" ||
		restoreStatus === "failed" ||
		restoreStatus === "gone";

	return (
		<div className="mx-auto w-[min(64rem,calc(100%-2.5rem))] min-w-0 max-w-full pt-10 pb-20 sm:pt-12">
			{stale && (
				<div className="block rounded-none border border-dashed border-muted-foreground bg-card px-4 py-2.5 text-center text-sm text-muted-foreground">
					<span aria-live="polite">
						Couldn&apos;t refresh — showing the last update.{" "}
					</span>
					<Button
						className="h-auto min-h-6 p-0 text-sm"
						onClick={() => void detail.refetch()}
						type="button"
						variant="link"
					>
						Retry
					</Button>
				</div>
			)}
			<header>
				<h1
					className="font-heading max-w-3xl text-4xl leading-[1.05] font-medium text-balance sm:text-5xl"
					tabIndex={-1}
				>
					{event?.title}
				</h1>
			</header>
			<div className="mt-6 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-y border-border py-3">
				<a
					aria-describedby={copyStatusId}
					className="inline-flex min-h-6 min-w-0 basis-full items-center text-sm break-all wrap-anywhere text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground sm:flex-1"
					href={url}
					suppressHydrationWarning
				>
					{url}
					<span className="sr-only"> (invite link — open this event)</span>
				</a>{" "}
				<div className="flex flex-wrap items-center gap-2">
					<Tooltip
						onOpenChange={copyTooltip.onOpenChange}
						open={copyTooltip.open}
					>
						<TooltipTrigger asChild>
							<Button
								aria-describedby={inviteHintId}
								aria-label="Copy invite link"
								className="min-h-6 shrink-0"
								onClick={() => void copy(url)}
								size="xs"
								type="button"
								variant="outline"
							>
								Copy
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{copyError
								? "Copy failed — select the link and copy it manually"
								: copied
									? "Copied!"
									: "Copy invite link"}
						</TooltipContent>
					</Tooltip>
					<span className="sr-only" id={inviteHintId}>
						Copies the invite link to your clipboard
					</span>
					<span aria-live="polite" className="sr-only" id={copyStatusId}>
						{copied
							? "Invite link copied to clipboard"
							: copyError
								? "Copy failed. Select the link and copy it manually."
								: ""}
					</span>{" "}
					<Tooltip
						onOpenChange={promptTooltip.onOpenChange}
						open={promptTooltip.open}
					>
						<TooltipTrigger asChild>
							<Button
								aria-describedby={promptHintId}
								aria-label="Copy agent prompt"
								className="min-h-6 shrink-0"
								onClick={() => void copyPrompt(agentPrompt)}
								size="xs"
								type="button"
								variant="outline"
							>
								Copy agent prompt
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							{promptCopyError
								? "Copy failed — select the link and copy it manually"
								: promptCopied
									? "Copied!"
									: "Copy agent prompt"}
						</TooltipContent>
					</Tooltip>
				</div>
				<span className="sr-only" id={promptHintId}>
					Copies a prompt that asks your agent to fill in your availability
				</span>
				<span aria-live="polite" className="sr-only" id={promptStatusId}>
					{promptCopied
						? "Agent prompt copied to clipboard"
						: promptCopyError
							? "Copy failed. Select the link and copy it manually."
							: ""}
				</span>
			</div>

			<div className="contents" suppressHydrationWarning>
				{signedIn ? (
					<div className="mt-6 flex min-h-6 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-4 text-sm">
						<span className="text-muted-foreground">
							Signed in as{" "}
							<strong className="font-semibold text-foreground">
								{activeName}
							</strong>
						</span>
						<span aria-live="polite" className="sr-only">
							Signed in as {activeName}
						</span>
						<Button
							className="h-auto min-h-6 p-0 text-sm"
							onClick={() => {
								cancel();
								lastSubmittedRef.current = null;
								resetSave();
								setSignedIn(false);
								setPassword("");
								setSelected(new Set());
								setActiveName("");
								setStoredName("");
								setName("");
								setSignError("");
								void deleteEventSession(eventId)
									.catch(() => undefined)
									.then(() =>
										queryClient.invalidateQueries({
											queryKey: ["own-session", eventId],
										}),
									);
							}}
							type="button"
							variant="link"
						>
							Switch user
						</Button>
					</div>
				) : null}

				<div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
					<Label
						className="text-muted-foreground"
						htmlFor="tz-view"
						id={tzLabelId}
					>
						Show times in
					</Label>
					<Select onValueChange={setView} value={viewTimezone}>
						<SelectTrigger
							aria-labelledby={tzLabelId}
							className="w-auto max-w-full min-w-56"
							id="tz-view"
							type="button"
						>
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

				{!signedIn ? (
					<section aria-labelledby={signInTitleId} className="mt-6">
						<h2
							className="font-heading text-2xl font-medium"
							id={signInTitleId}
						>
							Sign in to add your availability
						</h2>
						<p className="mt-1 max-w-prose text-sm text-muted-foreground">
							Your name and password are only for this event. New here? Make up
							a password. Returning? Use the same name and password.
						</p>
						<form
							aria-labelledby={signInTitleId}
							className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
							onSubmit={(e) => {
								e.preventDefault();
								void signIn();
							}}
						>
							<div className="grid gap-2">
								<Label htmlFor="who-name">Your name</Label>
								<Input
									aria-describedby={signError !== "" ? signErrorId : undefined}
									aria-invalid={signError !== "" ? true : undefined}
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
									aria-describedby={signError !== "" ? signErrorId : undefined}
									aria-invalid={signError !== "" ? true : undefined}
									autoComplete="current-password"
									id="who-pass"
									onChange={(e) => setPassword(e.target.value)}
									type="password"
									value={password}
								/>
							</div>
							<Button
								aria-busy={signing}
								aria-disabled={signing}
								onClick={(e) => {
									if (signing) e.preventDefault();
								}}
								type="submit"
							>
								{signing ? "Signing in…" : "Continue"}
							</Button>
						</form>
						{signError !== "" && (
							<p
								className="mt-3 text-sm text-destructive"
								id={signErrorId}
								ref={signErrorRef}
								role="alert"
								tabIndex={-1}
							>
								{signError}
							</p>
						)}
					</section>
				) : (
					<section aria-label="Your availability" className="mt-6">
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<h2
								className="font-heading text-2xl font-medium"
								ref={signedInRef}
								tabIndex={-1}
							>
								Your availability
							</h2>
							<span
								className="text-sm text-muted-foreground"
								aria-live={saveFailed ? undefined : "polite"}
								role={saveFailed ? "alert" : undefined}
							>
								{saveState}
							</span>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							Click or drag to paint the times you are free.
						</p>
						<div className="mt-5">
							<div className="mb-3 text-sm text-muted-foreground">
								<span aria-live="polite" id={restoreStatusId}>
									{restoreStatus === "restoring"
										? "Restoring…"
										: restoreStatus === "failed"
											? "Could not restore your availability."
											: ""}
								</span>{" "}
								{restoreStatus === "failed" ? (
									<Button
										className="h-auto min-h-6 p-0 text-sm"
										onClick={retryRestore}
										type="button"
										variant="link"
									>
										Retry
									</Button>
								) : null}
							</div>
							{restoreStatus === "gone" && (
								<p className="mb-3 text-sm text-muted-foreground" role="alert">
									This event has expired. Reload the page.
								</p>
							)}
							<AvailabilityGrid
								columns={columns}
								disabled={gridDisabled}
								disabledReasonId={restoreStatusId}
								onCommit={commit}
								selected={selected}
							/>
						</div>
					</section>
				)}

				<section aria-label="Group's availability" className="mt-6">
					<h2 className="font-heading text-2xl font-medium">
						Group&apos;s availability
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{total === 0
							? "No responses yet — share the invite link to gather availability."
							: "Darker green means more people are free. Hover or tap a slot to see who."}
					</p>
					<div className="mt-5">
						<GroupHeatmap
							allNames={allNames}
							announce={!signedIn}
							columns={columns}
							counts={counts}
							eventTimezone={event?.timezone}
							total={total}
							viewTimezone={viewTimezone}
						/>
					</div>
				</section>

				<PollsSection
					activeName={activeName}
					eventId={eventId}
					password={password}
					polls={detail.data?.polls ?? []}
					signedIn={signedIn}
				/>
			</div>
		</div>
	);
}
