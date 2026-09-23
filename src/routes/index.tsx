import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DateCalendar } from "#/components/date-calendar";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader } from "#/components/ui/card";
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
import {
	allTimezones,
	browserTimezone,
	formatSlotLabel,
} from "#/lib/time-slots";

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
				<div className="font-heading text-2xl font-bold">dilly dally</div>
				<nav className="flex items-center gap-1 text-sm">
					<Button asChild size="sm" variant="link">
						<a href="/api/agent-guide">Agent guide</a>
					</Button>
					<Button asChild size="sm" variant="link">
						<a href="/api/openapi.json">OpenAPI</a>
					</Button>
				</nav>
			</header>

			<Card className="mx-auto max-w-lg">
				<CardHeader>
					<h1 className="font-heading text-sm font-medium">Plan a new event</h1>
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
									<Button
										aria-pressed={mode === m.value}
										key={m.value}
										onClick={() => setMode(m.value)}
										size="sm"
										type="button"
										variant={mode === m.value ? "default" : "outline"}
									>
										{m.label}
									</Button>
								))}
							</fieldset>
						</div>
						{mode === "dates" ? (
							<div className="grid gap-2">
								<Label>What dates might work?</Label>
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
								<Label>What weekdays might work?</Label>
								<p className="text-xs text-muted-foreground">
									Availability means that weekday generally, every week. Click
									and drag weekdays to choose possibilities.
								</p>
								<WeekdayPicker onCommit={setWeekdays} selected={weekdays} />
							</div>
						)}
						<div className="grid gap-2">
							<Label>What times might work?</Label>
							<div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
								<span className="text-xs text-muted-foreground">
									No earlier than
								</span>
								<Select onValueChange={setStartTime} value={startTime}>
									<SelectTrigger
										aria-label="No earlier than"
										className="w-28"
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
								<span className="text-xs text-muted-foreground">
									No later than
								</span>
								<Select onValueChange={setEndTime} value={endTime}>
									<SelectTrigger
										aria-label="No later than"
										className="w-28"
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
		</div>
	);
}
