import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AvailabilityGrid } from "#/components/availability-grid";
import {
	buildColumns,
	buildWeeklyColumns,
	formatViewerSlot,
	summarizeDates,
	summarizeWeekdays,
} from "#/components/grid-model";
import { GroupHeatmap } from "#/components/group-heatmap";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { useCopyToClipboard } from "#/hooks/use-copy-to-clipboard";
import { useEventDetail } from "#/hooks/use-event-detail";
import { useLocalStorage } from "#/hooks/use-local-storage";
import { useOwnAvailabilityRestore } from "#/hooks/use-own-availability-restore";
import { useSerialSaver } from "#/hooks/use-serial-saver";
import {
	fetchOwnAvailability,
	HttpError,
	saveAvailability,
} from "#/lib/client";
import { fetchEventDetailServerFn } from "#/lib/event-detail-server";

export const Route = createFileRoute("/e/$eventId")({
	component: EventPage,
	errorComponent: EventError,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData({
			queryFn: async () => {
				const result = await fetchEventDetailServerFn({
					data: params.eventId,
				});
				if (!result.ok) {
					throw new HttpError(result.status, result.code, result.message);
				}
				return result.detail;
			},
			queryKey: ["event", params.eventId],
		});
	},
});

function EventError({ error }: { error: unknown }) {
	const gone = error instanceof HttpError && error.code === "gone";
	return (
		<div className="page-wrap py-16 text-center">
			<h1 className="display-title text-3xl font-bold">
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

function inviteUrl(eventId: string): string {
	if (typeof window === "undefined") return `/e/${eventId}`;
	return `${window.location.origin}/e/${eventId}`;
}

function EventPage() {
	const { eventId } = Route.useParams();
	const detail = useEventDetail(eventId);
	const eventMissing =
		detail.isError &&
		detail.error instanceof HttpError &&
		(detail.error.status === 404 || detail.error.status === 410);
	const queryClient = useQueryClient();
	const { copied, copy } = useCopyToClipboard();
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
	const { retry: retryRestore, status: restoreStatus } =
		useOwnAvailabilityRestore({
			eventId,
			eventMissing,
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
	const [view, setView] = useLocalStorage("dd:tz-view", "event");

	const event = detail.data?.event;
	const viewTimezone =
		view === "local" && typeof Intl !== "undefined"
			? Intl.DateTimeFormat().resolvedOptions().timeZone
			: (event?.timezone ?? "UTC");

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
	const bestTimes = useMemo(() => {
		return [...(detail.data?.bestTimes ?? [])].slice(0, 10);
	}, [detail.data]);
	const dateSummary = event
		? (event.mode ?? "dates") === "weekly"
			? summarizeWeekdays(event.weekdays ?? [])
			: summarizeDates(event.dates)
		: "";

	const signIn = async () => {
		setSignError("");
		if (!name.trim()) {
			setSignError("Enter your name to continue.");
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
			if (err instanceof HttpError && err.code === "invalid_password") {
				setSignError("That name is taken with a different password.");
				return;
			}
			if (
				err instanceof HttpError &&
				(err.code === "availability_not_found" ||
					(err.status === 404 && !eventMissing))
			) {
				lastSavedRef.current = new Set();
				setSelected(new Set());
				setActiveName(name.trim());
				setStoredName(name.trim());
			} else if (
				err instanceof HttpError &&
				(err.code === "gone" ||
					(err.status === 404 && eventMissing) ||
					err.status === 410)
			) {
				setSignError("This event is gone. Check the link and try again.");
				return;
			} else {
				setSignError("Could not sign in. Try again.");
				return;
			}
		} finally {
			setSigning(false);
		}
		setSignedIn(true);
	};

	const saver = useSerialSaver<Set<string>>({
		onError: (err) => {
			setSelected(new Set(lastSavedRef.current));
			if (err instanceof HttpError && err.code === "invalid_password") {
				setSaveState("Wrong password for this name. Change reverted.");
			} else if (err instanceof HttpError && err.code === "rate_limited") {
				setSaveState("Saving too fast. Change reverted; paint again.");
			} else {
				setSaveState("Could not save. Change reverted.");
			}
		},
		onSuccess: (value) => {
			lastSavedRef.current = new Set(value);
			setSaveState(`Saved ${new Date().toLocaleTimeString()}`);
			void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
		},
		save: async (value) => {
			await saveAvailability(eventId, {
				name: activeName,
				password: password === "" ? undefined : password,
				slots: [...value],
			});
		},
	});

	const commit = (next: Set<string>) => {
		setSelected(next);
		if (!signedIn || activeName === "") return;
		setSaveState("Saving…");
		saver.submit(next);
	};

	if (detail.isPending) {
		return (
			<div className="page-wrap py-16">
				<p className="text-muted-foreground">Loading event…</p>
			</div>
		);
	}

	if (detail.isError) {
		const err = detail.error;
		const gone = err instanceof HttpError && err.code === "gone";
		return (
			<div className="page-wrap py-16 text-center">
				<h1 className="display-title text-3xl font-bold">
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

	return (
		<div className="page-wrap rise-in pb-16">
			<header className="flex items-center justify-between py-5">
				<a className="display-title text-2xl font-bold" href="/">
					Dilly-Dally
				</a>
				<nav className="flex gap-4 text-sm">
					<a className="nav-link" href="/api/agent-guide">
						Agent guide
					</a>
				</nav>
			</header>

			<h1 className="display-title mt-2 text-3xl font-bold">{event?.title}</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				{event?.timezone} · {dateSummary} · {event?.startTime}–{event?.endTime}{" "}
				· Expires {event ? new Date(event.expiresAt).toLocaleDateString() : ""}
			</p>

			<Card className="island-shell mt-6 rounded-2xl">
				<CardHeader>
					<CardTitle>Invite people</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input aria-label="Invite link" readOnly value={url} />
						<div className="flex gap-2">
							<Button
								aria-live="polite"
								onClick={() => copy(url)}
								type="button"
								variant="secondary"
							>
								{copied ? "Copied!" : "Copy link"}
							</Button>
							<Button asChild variant="outline">
								<a
									href={`mailto:?subject=${encodeURIComponent(`When2meet: ${event?.title ?? ""}`)}&body=${encodeURIComponent(`Pick times that work for you: ${url}`)}`}
								>
									Email invite
								</a>
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			{!signedIn ? (
				<Card className="island-shell mt-4 rounded-2xl">
					<CardHeader>
						<CardTitle>Sign in</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="mb-4 text-sm text-muted-foreground">
							Your name and password are only for this event. New here? Make up
							a password. Returning? Use the same name and password.
						</p>
						<div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
							<div className="grid gap-2">
								<Label htmlFor="who-name">Your name</Label>
								<Input
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
									id="who-pass"
									onChange={(e) => setPassword(e.target.value)}
									type="password"
									value={password}
								/>
							</div>
							<Button disabled={signing} onClick={signIn} type="button">
								{signing ? "Signing in…" : "Continue"}
							</Button>
						</div>
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
					<button
						className="nav-link text-sm"
						onClick={() => {
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
					>
						Switch user
					</button>
				</div>
			)}

			<div className="mt-4 flex items-center gap-2 text-sm">
				<span className="text-muted-foreground">Show times in</span>
				<fieldset className="flex gap-1">
					<legend className="sr-only">Timezone view</legend>
					{(["event", "local"] as const).map((v) => (
						<button
							aria-pressed={view === v}
							className={
								view === v
									? "rounded-md border border-emerald-700 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900"
									: "rounded-md border border-input px-2 py-1 text-xs text-muted-foreground"
							}
							key={v}
							onClick={() => setView(v)}
							type="button"
						>
							{v === "event" ? `Event time` : "My time"}
						</button>
					))}
				</fieldset>
				<span className="text-xs text-muted-foreground">{viewTimezone}</span>
			</div>

			<Card className="island-shell mt-4 rounded-2xl">
				<CardHeader>
					<CardTitle>
						Your availability{" "}
						{saveState !== "" && (
							<span
								aria-live="polite"
								className="text-xs font-normal text-muted-foreground"
							>
								{saveState}
							</span>
						)}
					</CardTitle>
				</CardHeader>
				<CardContent>
					{!signedIn ? (
						<p className="text-sm text-muted-foreground">
							Sign in above, then click and drag to paint the times you are
							free.
						</p>
					) : (
						<>
							{restoreStatus === "restoring" && (
								<p className="mb-2 text-sm text-muted-foreground">Restoring…</p>
							)}
							{restoreStatus === "failed" && (
								<p className="mb-2 text-sm text-muted-foreground">
									Could not restore your availability.{" "}
									<button
										className="nav-link text-sm"
										onClick={retryRestore}
										type="button"
									>
										Retry
									</button>
								</p>
							)}
							<AvailabilityGrid
								columns={columns}
								disabled={
									restoreStatus === "restoring" || restoreStatus === "failed"
								}
								onCommit={commit}
								selected={selected}
							/>
						</>
					)}
				</CardContent>
			</Card>

			<Card className="island-shell mt-4 rounded-2xl">
				<CardHeader>
					<CardTitle>
						Group&apos;s availability{" "}
						<Badge variant="secondary">
							{total} {total === 1 ? "person" : "people"}
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<GroupHeatmap
						allNames={allNames}
						columns={columns}
						counts={counts}
						eventTimezone={event?.timezone}
						total={total}
						viewTimezone={viewTimezone}
					/>
					<div className="mt-4">
						<div className="text-sm font-semibold">Best times</div>
						<ol className="mt-1 grid gap-1 text-sm">
							{bestTimes.map((b) => (
								<li
									className="flex items-center justify-between gap-2"
									key={b.slot}
									title={
										event
											? formatViewerSlot(b.slot, event.timezone, viewTimezone)
											: b.slot
									}
								>
									<span>
										{event
											? formatViewerSlot(b.slot, event.timezone, viewTimezone)
											: b.slot}
									</span>
									<Badge
										variant={
											b.count === total && total > 0 ? "default" : "secondary"
										}
									>
										{b.count}/{total} free
									</Badge>
								</li>
							))}
						</ol>
					</div>
					<div className="mt-4">
						<div className="text-sm font-semibold">Who responded</div>
						<ul className="mt-1 grid gap-1 text-sm text-muted-foreground">
							{(detail.data?.participants ?? []).map((p) => (
								<li className="flex justify-between gap-2" key={p.name}>
									<span>{p.name}</span>
									<span>
										{p.count} slots · {new Date(p.updatedAt).toLocaleString()}
									</span>
								</li>
							))}
						</ul>
					</div>
				</CardContent>
			</Card>

			<footer className="mt-8 text-center text-xs text-muted-foreground">
				The link is the event, keep it. Data auto-deletes after the event
				passes. Agents: see <a href="/api/agent-guide">/api/agent-guide</a> and{" "}
				<a href="/api/openapi.json">/api/openapi.json</a>.
			</footer>
		</div>
	);
}
