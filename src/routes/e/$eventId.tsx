import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useId, useMemo, useRef, useState } from "react";
import { AvailabilityGrid } from "#/components/availability-grid";
import { buildColumns, buildWeeklyColumns } from "#/components/grid-model";
import { GroupHeatmap, heatmapAnnounce } from "#/components/group-heatmap";
import { SiteHeader } from "#/components/site-header";
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
import { useErrorFocus } from "#/hooks/use-error-focus";
import { useEventDetail } from "#/hooks/use-event-detail";
import { useFocusOnChange } from "#/hooks/use-focus-on-change";
import { useLocalStorage } from "#/hooks/use-local-storage";
import { useOwnAvailabilityRestore } from "#/hooks/use-own-availability-restore";
import { useSerialSaver } from "#/hooks/use-serial-saver";
import { useTooltipOpen } from "#/hooks/use-tooltip-open";
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
			<h1 className="font-heading text-3xl font-bold" tabIndex={-1}>
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
	const copyTooltip = useTooltipOpen(copied || copyError);
	const [storedName, setStoredName] = useLocalStorage(`dd:${eventId}:name`, "");
	const [name, setName] = useState(storedName);
	const [password, setPassword] = useState("");
	const [activeName, setActiveName] = useState(storedName.trim());
	const [signedIn, setSignedIn] = useState(storedName.trim() !== "");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [saveState, setSaveState] = useState("");
	const [saveFailed, setSaveFailed] = useState(false);
	const [signError, setSignError] = useState("");
	const [signing, setSigning] = useState(false);
	const lastSavedRef = useRef<Set<string>>(new Set());
	const lastSubmittedRef = useRef<{
		password: string | undefined;
		identity: string;
		slots: Set<string>;
	} | null>(null);
	const signErrorId = useId();
	const signInTitleId = useId();
	const inviteHintId = useId();
	const copyStatusId = useId();
	const restoreStatusId = useId();
	const tzLabelId = useId();
	const signErrorRef = useErrorFocus<HTMLParagraphElement>(signError);
	const signedInRef = useFocusOnChange<HTMLHeadingElement>(signedIn);
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
		if (signing) return;
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
			setSaveFailed(true);
			setSaveState(saveErrorMessage(err));
		},
		onSuccess: (value) => {
			lastSavedRef.current = new Set(value.slots);
			if (value === lastSubmittedRef.current) {
				setSelected(new Set(value.slots));
			}
			setSaveFailed(false);
			setSaveState("Saved");
			if (value.identity.trim() !== "") {
				const stamp = new Date().toISOString();
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
		setSaveFailed(false);
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
				<div className="mx-auto w-[min(1080px,calc(100%-2rem))] py-16 text-center">
					<h1 className="font-heading text-3xl font-bold" tabIndex={-1}>
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
				<h1 className="font-heading text-3xl font-bold" tabIndex={-1}>
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
	const gridDisabled =
		restoreStatus === "restoring" ||
		restoreStatus === "failed" ||
		restoreStatus === "gone";

	return (
		<div className="mx-auto w-[min(1080px,calc(100%-2rem))] pb-16">
			{stale && (
				<div className="mt-4 block rounded-xl border border-muted-foreground bg-card px-3 py-2 text-center text-sm text-muted-foreground">
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
			<SiteHeader />

			<h1 className="font-heading mt-2 text-3xl font-bold" tabIndex={-1}>
				{event?.title}
			</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				{event?.timezone} ·{" "}
				<a
					aria-describedby={copyStatusId}
					className="inline-flex min-h-6 items-center text-primary underline underline-offset-4 hover:text-[color-mix(in_oklch,var(--primary),white_15%)]"
					href={url}
					suppressHydrationWarning
				>
					{url}
					<span className="sr-only"> (invite link — open this event)</span>
				</a>{" "}
				<Tooltip
					onOpenChange={copyTooltip.onOpenChange}
					open={copyTooltip.open}
				>
					<TooltipTrigger asChild>
						<Button
							aria-describedby={inviteHintId}
							aria-label="Copy invite link"
							className="min-h-6"
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
				</span>
			</p>

			<div className="contents" suppressHydrationWarning>
				{signedIn ? (
					<div className="mt-4 flex min-h-6 flex-wrap items-center gap-3 text-sm">
						<span>
							Signed in as <strong>{activeName}</strong>
						</span>
						<span aria-live="polite" className="sr-only">
							Signed in as {activeName}
						</span>
						<Button
							className="h-auto min-h-6 p-0 text-sm"
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
								setSaveFailed(false);
								setSignError("");
							}}
							type="button"
							variant="link"
						>
							Switch user
						</Button>
					</div>
				) : null}

				<div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
					<Label htmlFor="tz-view" id={tzLabelId}>
						Show times in
					</Label>
					<Select onValueChange={setView} value={viewTimezone}>
						<SelectTrigger
							aria-labelledby={tzLabelId}
							className="w-80"
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
					<Card className="mt-4">
						<CardHeader>
							<CardTitle id={signInTitleId}>
								Sign in to add your availability
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="mb-4 text-sm text-muted-foreground">
								Your name and password are only for this event. New here? Make
								up a password. Returning? Use the same name and password.
							</p>
							<form
								aria-labelledby={signInTitleId}
								className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
								onSubmit={(e) => {
									e.preventDefault();
									void signIn();
								}}
							>
								<div className="grid gap-2">
									<Label htmlFor="who-name">Your name</Label>
									<Input
										aria-describedby={
											signError !== "" ? signErrorId : undefined
										}
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
										aria-describedby={
											signError !== "" ? signErrorId : undefined
										}
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
									className="mt-2 text-sm text-destructive"
									id={signErrorId}
									ref={signErrorRef}
									role="alert"
									tabIndex={-1}
								>
									{signError}
								</p>
							)}
						</CardContent>
					</Card>
				) : (
					<Card className="mt-4">
						<CardHeader>
							<CardTitle ref={signedInRef} tabIndex={-1}>
								Your availability{" "}
								<span
									className="text-xs font-normal text-muted-foreground"
									aria-live={saveFailed ? undefined : "polite"}
									role={saveFailed ? "alert" : undefined}
								>
									{saveState}
								</span>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="mb-2 text-sm text-muted-foreground">
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
								<p className="mb-2 text-sm text-muted-foreground" role="alert">
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
						</CardContent>
					</Card>
				)}

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
			</div>

			<footer className="mt-8 text-center text-xs text-muted-foreground">
				The link is the event, keep it. Data auto-deletes after the event
				passes. Agents: see{" "}
				<a
					className="inline-flex min-h-6 items-center text-primary underline underline-offset-4 hover:text-[color-mix(in_oklch,var(--primary),white_15%)]"
					href="/api/agent-guide"
				>
					/api/agent-guide
				</a>{" "}
				and{" "}
				<a
					className="inline-flex min-h-6 items-center text-primary underline underline-offset-4 hover:text-[color-mix(in_oklch,var(--primary),white_15%)]"
					href="/api/openapi.json"
				>
					/api/openapi.json
				</a>
				.
			</footer>
		</div>
	);
}
