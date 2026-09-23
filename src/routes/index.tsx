import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DateCalendar } from "#/components/date-calendar";
import { summarizeDates, summarizeWeekdays } from "#/components/grid-model";
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
import { WeekdayPicker } from "#/components/weekday-picker";
import { createEvent } from "#/lib/client";
import { HttpError } from "#/lib/http-error";
import { formatSlotLabel } from "#/lib/time-slots";

export const Route = createFileRoute("/")({ component: Home });

function todayPlus(days: number): string {
	const d = new Date();
	d.setDate(d.getDate() + days);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function hourOptions(): string[] {
	return Array.from(
		{ length: 24 },
		(_, h) => `${String(h).padStart(2, "0")}:00`,
	);
}

function browserTimezone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
}

function allTimezones(): string[] {
	try {
		const supported = (
			Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
		).supportedValuesOf?.("timeZone");
		if (supported && supported.length > 0) return supported;
	} catch {}
	return [browserTimezone()];
}

function Home() {
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [mode, setMode] = useState<"dates" | "weekly">("dates");
	const [dates, setDates] = useState<Set<string>>(new Set());
	const [weekdays, setWeekdays] = useState<Set<number>>(
		new Set([1, 2, 3, 4, 5]),
	);
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("17:00");
	const [timezone, setTimezone] = useState(browserTimezone);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const minDate = todayPlus(0);
	const maxDate = todayPlus(90);

	const submit = async () => {
		setError("");
		if (!title.trim()) {
			setError("Give your event a name.");
			return;
		}
		if (mode === "dates" && dates.size === 0) {
			setError("Pick at least one date that might work.");
			return;
		}
		if (mode === "weekly" && weekdays.size === 0) {
			setError("Pick at least one weekday that might work.");
			return;
		}
		if (startTime >= endTime) {
			setError("The end time must be after the start time.");
			return;
		}
		setSaving(true);
		try {
			const res = await createEvent(
				mode === "weekly"
					? {
							endTime,
							mode: "weekly",
							startTime,
							timezone,
							title: title.trim(),
							weekdays: [...weekdays].sort((a, b) => a - b),
						}
					: {
							dates: [...dates].sort(),
							endTime,
							startTime,
							timezone,
							title: title.trim(),
						},
			);
			await navigate({ params: { eventId: res.id }, to: "/e/$eventId" });
		} catch (err) {
			if (err instanceof HttpError && err.code === "rate_limited") {
				setError("Too many events right now. Wait a bit and try again.");
			} else if (err instanceof HttpError && err.fields) {
				setError(Object.values(err.fields).flat().join(" "));
			} else {
				setError("Could not create the event. Try again.");
			}
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="mx-auto w-[min(1080px,calc(100%-2rem))] animate-in fade-in slide-in-from-bottom-3 duration-700 pb-16">
			<header className="flex items-center justify-between py-5">
				<div className="font-display text-2xl font-bold">Dilly-Dally</div>
				<nav className="flex gap-4 text-sm">
					<a
						className="relative inline-flex min-h-6 items-center py-0.5 text-[#416166] no-underline transition-colors duration-200 after:absolute after:bottom-[-8px] after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-[#4fb8b2] after:to-[#7ed3bf] after:transition-transform after:duration-200 hover:text-[#173a40] hover:after:scale-x-100 dark:text-[#afcdc8] dark:hover:text-[#d7ece8]"
						href="/api/agent-guide"
					>
						Agent guide
					</a>
					<a
						className="relative inline-flex min-h-6 items-center py-0.5 text-[#416166] no-underline transition-colors duration-200 after:absolute after:bottom-[-8px] after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-[#4fb8b2] after:to-[#7ed3bf] after:transition-transform after:duration-200 hover:text-[#173a40] hover:after:scale-x-100 dark:text-[#afcdc8] dark:hover:text-[#d7ece8]"
						href="/api/openapi.json"
					>
						OpenAPI
					</a>
				</nav>
			</header>

			<section className="mt-6 text-center">
				<p className="text-[0.69rem] font-bold uppercase tracking-[0.16em] text-emerald-900/90 dark:text-teal-200">
					Find a time that works for everyone
				</p>
				<h1 className="mt-2 font-display text-4xl font-bold text-balance sm:text-5xl">
					Stop dilly-dallying. Pick a time.
				</h1>
				<p className="mx-auto mt-3 max-w-xl text-muted-foreground">
					Name your event, paint the dates that might work, share one link. No
					login. Agents welcome: everything works over curl too.
				</p>
			</section>

			<Card className="mx-auto mt-8 max-w-2xl rounded-2xl border-[#173a40]/15 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_22px_44px_rgba(30,90,72,0.10),0_6px_18px_rgba(23,58,64,0.08)] backdrop-blur-sm transition-colors duration-200 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none">
				<CardHeader>
					<CardTitle>Plan a new event</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-5"
						onSubmit={(e) => {
							e.preventDefault();
							void submit();
						}}
					>
						<div className="grid gap-2">
							<Label htmlFor="event-name">New event name</Label>
							<Input
								id="event-name"
								maxLength={100}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Team offsite planning"
								value={title}
							/>
						</div>
						<div className="grid gap-2">
							<Label>Specific dates or a weekly repeat?</Label>
							<fieldset className="flex gap-1">
								<legend className="sr-only">Event mode</legend>
								{(
									[
										{ label: "Specific dates", value: "dates" },
										{ label: "Weekly", value: "weekly" },
									] as const
								).map((m) => (
									<button
										aria-pressed={mode === m.value}
										className={
											mode === m.value
												? "rounded-md border border-emerald-700 bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-900"
												: "rounded-md border border-input px-2 py-1 text-xs text-muted-foreground"
										}
										key={m.value}
										onClick={() => setMode(m.value)}
										type="button"
									>
										{m.label}
									</button>
								))}
							</fieldset>
						</div>
						{mode === "dates" ? (
							<div className="grid gap-2">
								<Label>
									What dates might work?{" "}
									<output aria-live="polite" className="text-muted-foreground">
										{dates.size === 0
											? "(No dates selected)"
											: `(${summarizeDates([...dates])})`}
									</output>
								</Label>
								<p className="text-xs text-muted-foreground">
									Click and drag dates to choose possibilities.
								</p>
								<DateCalendar
									maxDate={maxDate}
									minDate={minDate}
									onCommit={setDates}
									selected={dates}
								/>
							</div>
						) : (
							<div className="grid gap-2">
								<Label>
									What weekdays might work?{" "}
									<output aria-live="polite" className="text-muted-foreground">
										{weekdays.size === 0
											? "(No weekdays selected)"
											: `(${summarizeWeekdays([...weekdays])})`}
									</output>
								</Label>
								<p className="text-xs text-muted-foreground">
									Availability means that weekday generally, every week. Click
									and drag weekdays to choose possibilities.
								</p>
								<WeekdayPicker onCommit={setWeekdays} selected={weekdays} />
							</div>
						)}
						<div className="grid gap-2">
							<Label>What times might work?</Label>
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-sm text-muted-foreground">
									No earlier than
								</span>
								<Select onValueChange={setStartTime} value={startTime}>
									<SelectTrigger
										aria-label="No earlier than"
										className="w-32"
										type="button"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{hourOptions().map((h) => (
											<SelectItem key={h} value={h}>
												{formatSlotLabel(`2026-01-01T${h}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<span className="text-sm text-muted-foreground">
									No later than
								</span>
								<Select onValueChange={setEndTime} value={endTime}>
									<SelectTrigger
										aria-label="No later than"
										className="w-32"
										type="button"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{hourOptions().map((h) => (
											<SelectItem key={h} value={h}>
												{formatSlotLabel(`2026-01-01T${h}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="tz">Time zone</Label>
							<Input
								id="tz"
								list="tz-list"
								onChange={(e) => setTimezone(e.target.value)}
								value={timezone}
							/>
							<datalist id="tz-list">
								{allTimezones().map((tz) => (
									<option key={tz} value={tz} />
								))}
							</datalist>
						</div>
						{error !== "" && (
							<p className="text-sm text-destructive" role="alert">
								{error}
							</p>
						)}
						<Button disabled={saving} size="lg" type="submit">
							{saving ? "Creating…" : "Create event"}
						</Button>
					</form>
				</CardContent>
			</Card>

			<section className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
				{[
					{ body: "Name it, pick dates and times.", head: "1. Create" },
					{ body: "One link is the whole event.", head: "2. Share" },
					{ body: "Paint availability, read the green.", head: "3. Meet" },
				].map((s) => (
					<div
						className="rounded-2xl border border-[#173a40]/15 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_18px_34px_rgba(30,90,72,0.10),0_4px_14px_rgba(23,58,64,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-700/35 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none"
						key={s.head}
					>
						<div className="font-semibold">{s.head}</div>
						<div className="mt-1 text-sm text-muted-foreground">{s.body}</div>
					</div>
				))}
			</section>
		</div>
	);
}
