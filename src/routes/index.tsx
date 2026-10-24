import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { DateCalendar } from "#/components/date-calendar";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader } from "#/components/ui/card";
import { Checkbox } from "#/components/ui/checkbox";
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
import { useErrorFocus } from "#/hooks/use-error-focus";
import { useGroupLabelling } from "#/hooks/use-group-labelling";
import { useHourCycle } from "#/hooks/use-hour-cycle";
import { useHydrated } from "#/hooks/use-hydrated";
import { useRadioGroup } from "#/hooks/use-radio-group";
import { createEvent } from "#/lib/client";
import { HttpError } from "#/lib/http-error";
import {
	allTimezones,
	browserTimezone,
	formatSlotLabel,
	todayPlusInTimezone,
} from "#/lib/time-slots";
import { MAX_OPTIONS_PER_POLL, MAX_POLLS_PER_EVENT } from "#/lib/validation";

export const Route = createFileRoute("/")({ component: Home });

function hourOptions(): string[] {
	return Array.from({ length: 48 }, (_, i) => {
		const h = Math.floor(i / 2);
		const m = i % 2 === 0 ? "00" : "30";
		return `${String(h).padStart(2, "0")}:${m}`;
	});
}

interface FieldErrors {
	title?: string;
	dates?: string;
	weekdays?: string;
	time?: string;
	timeField?: "end" | "start";
	timezone?: string;
	polls?: string;
}

interface PollDraft {
	allowMultiple: boolean;
	key: number;
	options: Array<{ key: number; value: string }>;
	question: string;
}

function isValidTimezone(tz: string): boolean {
	try {
		Intl.DateTimeFormat(undefined, { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

function Home() {
	const navigate = useNavigate();
	const hydrated = useHydrated();
	const [title, setTitle] = useState("");
	const [mode, setMode] = useState<"dates" | "weekly">("dates");
	const [dates, setDates] = useState<Set<string>>(new Set());
	const [weekdays, setWeekdays] = useState<Set<number>>(
		new Set([1, 2, 3, 4, 5]),
	);
	const [pollDrafts, setPollDrafts] = useState<PollDraft[]>([]);
	const nextPollKey = useRef(0);
	const nextOptionKey = useRef(0);
	const [startTime, setStartTime] = useState("09:00");
	const [endTime, setEndTime] = useState("17:00");
	const [timezoneOverride, setTimezoneOverride] = useState("");
	const browserTz = hydrated ? browserTimezone() : "UTC";
	const hourCycle = useHourCycle();
	const timezone = timezoneOverride !== "" ? timezoneOverride : browserTz;
	const [error, setError] = useState("");
	const [fields, setFields] = useState<FieldErrors>({});
	const [saving, setSaving] = useState(false);
	const [minDate, maxDate] = useMemo(
		() => [
			todayPlusInTimezone(0, browserTz),
			todayPlusInTimezone(90, browserTz),
		],
		[browserTz],
	);
	const summaryRef = useErrorFocus<HTMLDivElement>(error);
	const modeGroup = useGroupLabelling("mode");
	const datesGroup = useGroupLabelling("dates");
	const weekdaysGroup = useGroupLabelling("weekdays");
	const timesGroup = useGroupLabelling("times");
	const tzHintId = "tz-hint";
	const modeRadio = useRadioGroup({
		onChange: setMode,
		value: mode,
		values: ["dates", "weekly"] as const,
	});
	const fail = (nextFields: FieldErrors, summary: string) => {
		setFields(nextFields);
		setError(summary);
	};

	const submit = async () => {
		setError("");
		setFields({});
		const nextFields: FieldErrors = {};
		if (!title.trim()) {
			nextFields.title = "Give your event a name.";
		}
		if (mode === "dates" && dates.size === 0) {
			nextFields.dates = "Pick at least one date that might work.";
		}
		if (mode === "weekly" && weekdays.size === 0) {
			nextFields.weekdays = "Pick at least one weekday that might work.";
		}
		if (startTime >= endTime) {
			nextFields.time =
				"The end time must be after the start time. The “No later than” time must be later than the “No earlier than” time.";
			nextFields.timeField = "end";
		}
		if (timezoneOverride !== "" && !isValidTimezone(timezoneOverride)) {
			nextFields.timezone =
				"Enter a valid time zone, for example America/New_York.";
		}
		if (pollDrafts.length > MAX_POLLS_PER_EVENT) {
			nextFields.polls = "Events have at most 10 polls.";
		} else {
			for (const [idx, draft] of pollDrafts.entries()) {
				const q = draft.question.trim();
				const labels = draft.options
					.map((o) => o.value.trim())
					.filter((o) => o !== "");
				if (q === "" || labels.length < 2) {
					nextFields.polls = `Poll ${idx + 1} needs a question and at least two options.`;
					break;
				}
				if (q.length > 140 || labels.some((l) => l.length > 80)) {
					nextFields.polls = `Poll ${idx + 1} has text that is too long.`;
					break;
				}
				if (
					new Set(labels.map((l) => l.toLowerCase())).size !== labels.length
				) {
					nextFields.polls = `Poll ${idx + 1} options must be unique.`;
					break;
				}
			}
			const seenQuestions = new Set<string>();
			for (const draft of pollDrafts) {
				const k = draft.question.trim().toLowerCase();
				if (seenQuestions.has(k)) {
					nextFields.polls = "Poll questions must be unique.";
					break;
				}
				seenQuestions.add(k);
			}
		}
		if (Object.keys(nextFields).length > 0) {
			const summary = Object.values(nextFields).join(" ");
			fail(nextFields, summary);
			return;
		}
		setSaving(true);
		try {
			const pollsPayload =
				pollDrafts.length === 0
					? undefined
					: pollDrafts.map((d) => ({
							allowMultiple: d.allowMultiple,
							options: d.options
								.map((o) => o.value.trim())
								.filter((o) => o !== ""),
							question: d.question.trim(),
						}));
			const res = await createEvent(
				mode === "weekly"
					? {
							endTime,
							mode: "weekly",
							polls: pollsPayload,
							startTime,
							timezone,
							title: title.trim(),
							weekdays: [...weekdays].sort((a, b) => a - b),
						}
					: {
							dates: [...dates].sort(),
							endTime,
							polls: pollsPayload,
							startTime,
							timezone,
							title: title.trim(),
						},
			);
			await navigate({ params: { eventId: res.id }, to: "/e/$eventId" });
		} catch (err) {
			if (err instanceof HttpError && err.code === "rate_limited") {
				fail({}, "Too many events right now. Wait a bit and try again.");
			} else if (err instanceof HttpError && err.fields) {
				const mapped: FieldErrors = {};
				const msgs: string[] = [];
				for (const [key, values] of Object.entries(err.fields)) {
					const text = values.join(" ");
					msgs.push(text);
					if (key === "title") mapped.title = text;
					else if (key === "timezone") mapped.timezone = text;
					else if (key === "dates") mapped.dates = text;
					else if (key === "weekdays") mapped.weekdays = text;
					else if (key === "endTime") {
						mapped.time = text;
						mapped.timeField = "end";
					} else if (key === "startTime") {
						mapped.time = text;
						mapped.timeField = "start";
					} else if (key.startsWith("polls")) {
						mapped.polls = text;
					} else if (key === "end_time" || key === "start_time") {
						mapped.time = text;
						mapped.timeField = "end";
					}
				}
				const summary =
					msgs.length > 0
						? msgs.join(" ")
						: "Could not create the event. Try again.";
				fail(mapped, summary);
			} else {
				fail({}, "Could not create the event. Try again.");
			}
		} finally {
			setSaving(false);
		}
	};

	const titleDescribedBy =
		fields.title !== undefined ? "event-name-error" : undefined;
	const tzDescribedBy =
		fields.timezone !== undefined ? `${tzHintId} tz-error` : tzHintId;
	const datesDescribedBy =
		fields.dates !== undefined
			? `${datesGroup.hintId} dates-error`
			: datesGroup.hintId;
	const weekdaysDescribedBy =
		fields.weekdays !== undefined
			? `${weekdaysGroup.hintId} weekdays-error`
			: weekdaysGroup.hintId;
	const timeDescribedBy =
		fields.time !== undefined
			? `${timesGroup.hintId} time-error`
			: timesGroup.hintId;
	const endInvalid = fields.timeField === "end" && fields.time !== undefined;
	const startInvalid =
		fields.timeField === "start" && fields.time !== undefined;

	return (
		<div className="mx-auto w-[min(1080px,calc(100%-2rem))] pt-6 pb-16 sm:pt-8">
			<Card className="mx-auto max-w-lg">
				<CardHeader>
					<h1
						className="font-heading text-sm font-medium"
						id="plan-heading"
						tabIndex={-1}
					>
						Plan a new event
					</h1>
				</CardHeader>
				<CardContent>
					<form
						aria-labelledby="plan-heading"
						className="grid gap-5"
						noValidate
						onSubmit={(e) => {
							e.preventDefault();
							void submit();
						}}
					>
						<div className="grid gap-2">
							<Label htmlFor="event-name">New event name</Label>
							<Input
								aria-describedby={titleDescribedBy}
								aria-invalid={fields.title !== undefined}
								aria-required="true"
								id="event-name"
								maxLength={100}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Team offsite planning"
								required
								value={title}
							/>
							{fields.title !== undefined && (
								<p className="text-xs text-destructive" id="event-name-error">
									{fields.title}
								</p>
							)}
						</div>
						<div className="grid gap-2">
							<span className="text-xs leading-none" id={modeGroup.labelId}>
								Specific dates or a weekly repeat?
							</span>
							<div
								aria-labelledby={modeGroup.labelId}
								className="grid grid-cols-2 gap-1 sm:flex sm:w-auto"
								onKeyDown={modeRadio.onKeyDown}
								role="radiogroup"
							>
								{(
									[
										{ label: "Specific dates", value: "dates" },
										{ label: "Weekly", value: "weekly" },
									] as const
								).map((m) => (
									<Button
										{...modeRadio.getOptionProps(m.value)}
										className="min-h-11 flex-1 sm:h-7 sm:min-h-0 sm:flex-none"
										key={m.value}
										onClick={() => setMode(m.value)}
										size="sm"
										type="button"
										variant={mode === m.value ? "default" : "outline"}
									>
										{m.label}
									</Button>
								))}
							</div>
						</div>
						{mode === "dates" ? (
							<fieldset
								aria-describedby={datesDescribedBy}
								className="grid gap-2"
							>
								<legend
									className="text-xs leading-none"
									id={datesGroup.labelId}
								>
									What dates might work?
								</legend>
								<p
									className="text-xs text-muted-foreground"
									id={datesGroup.hintId}
								>
									Click and drag dates to choose possibilities.
								</p>
								{hydrated ? (
									<DateCalendar
										describedBy={datesDescribedBy}
										labelledBy={datesGroup.labelId}
										maxDate={maxDate}
										minDate={minDate}
										onCommit={setDates}
										selected={dates}
									/>
								) : (
									/* biome-ignore lint/a11y/useSemanticElements: loading indicator, not form output */
									<div
										className="block h-[400px] animate-pulse rounded-md bg-muted/50"
										role="status"
									>
										<span className="sr-only">Loading calendar</span>
									</div>
								)}
								{fields.dates !== undefined && (
									<p className="text-xs text-destructive" id="dates-error">
										{fields.dates}
									</p>
								)}
							</fieldset>
						) : (
							<fieldset
								aria-describedby={weekdaysDescribedBy}
								className="grid gap-2"
							>
								<legend
									className="text-xs leading-none"
									id={weekdaysGroup.labelId}
								>
									What weekdays might work?
								</legend>
								<p
									className="text-xs text-muted-foreground"
									id={weekdaysGroup.hintId}
								>
									Click and drag weekdays to choose days.
								</p>
								<WeekdayPicker
									describedBy={weekdaysDescribedBy}
									labelledBy={weekdaysGroup.labelId}
									onCommit={setWeekdays}
									selected={weekdays}
								/>
								{fields.weekdays !== undefined && (
									<p className="text-xs text-destructive" id="weekdays-error">
										{fields.weekdays}
									</p>
								)}
							</fieldset>
						)}
						<fieldset aria-describedby={timeDescribedBy} className="grid gap-2">
							<legend className="text-xs leading-none" id={timesGroup.labelId}>
								What times might work?
							</legend>
							<p
								className="text-xs text-muted-foreground"
								id={timesGroup.hintId}
							>
								Choose the earliest start and latest end within the event time
								zone.
							</p>
							<div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
								<span className="text-xs text-muted-foreground">
									No earlier than
								</span>
								<Select onValueChange={setStartTime} value={startTime}>
									<SelectTrigger
										aria-describedby={timeDescribedBy}
										aria-invalid={startInvalid}
										aria-label="No earlier than"
										className="w-28"
										id="start-time"
										type="button"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{hourOptions().map((h) => (
											<SelectItem key={h} value={h}>
												{formatSlotLabel(`2026-01-01T${h}`, hourCycle)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<span className="text-xs text-muted-foreground">
									No later than
								</span>
								<Select onValueChange={setEndTime} value={endTime}>
									<SelectTrigger
										aria-describedby={timeDescribedBy}
										aria-invalid={endInvalid}
										aria-label="No later than"
										className="w-28"
										id="end-time"
										type="button"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{hourOptions().map((h) => (
											<SelectItem key={h} value={h}>
												{formatSlotLabel(`2026-01-01T${h}`, hourCycle)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							{fields.time !== undefined && (
								<p className="text-xs text-destructive" id="time-error">
									{fields.time}
								</p>
							)}
						</fieldset>
						<fieldset className="grid gap-2">
							<legend className="text-xs leading-none">Polls (optional)</legend>
							<p className="text-xs text-muted-foreground">
								Add up to 10 polls. Each needs a question and 2-10 options.
							</p>
							{pollDrafts.map((draft, pIdx) => (
								<div
									className="grid gap-2 rounded-none border p-3"
									key={draft.key}
								>
									<div className="grid gap-2">
										<Label htmlFor={`poll-q-${draft.key}`}>
											Question {pIdx + 1}
										</Label>
										<Input
											id={`poll-q-${draft.key}`}
											maxLength={140}
											onChange={(e) => {
												const v = e.target.value;
												setPollDrafts((prev) =>
													prev.map((d) =>
														d.key === draft.key ? { ...d, question: v } : d,
													),
												);
											}}
											placeholder="Where should we eat?"
											value={draft.question}
										/>
									</div>
									<div className="grid gap-2">
										<span className="text-xs">Options</span>
										{draft.options.map((opt) => (
											<Input
												aria-label={`Poll ${pIdx + 1} option ${draft.options.findIndex((o) => o.key === opt.key) + 1}`}
												key={opt.key}
												maxLength={80}
												onChange={(e) => {
													const v = e.target.value;
													setPollDrafts((prev) =>
														prev.map((d, i) =>
															i === pIdx
																? {
																		...d,
																		options: d.options.map((o) =>
																			o.key === opt.key
																				? { ...o, value: v }
																				: o,
																		),
																	}
																: d,
														),
													);
												}}
												placeholder={`Option ${draft.options.findIndex((o) => o.key === opt.key) + 1}`}
												value={opt.value}
											/>
										))}
										<div className="flex gap-2">
											{draft.options.length < MAX_OPTIONS_PER_POLL ? (
												<Button
													onClick={() =>
														setPollDrafts((prev) =>
															prev.map((d, i) =>
																i === pIdx
																	? {
																			...d,
																			options: [
																				...d.options,
																				{
																					key: nextOptionKey.current++,
																					value: "",
																				},
																			],
																		}
																	: d,
															),
														)
													}
													size="sm"
													type="button"
													variant="outline"
												>
													Add option
												</Button>
											) : null}
											{draft.options.length > 2 ? (
												<Button
													onClick={() =>
														setPollDrafts((prev) =>
															prev.map((d, i) =>
																i === pIdx
																	? { ...d, options: d.options.slice(0, -1) }
																	: d,
															),
														)
													}
													size="sm"
													type="button"
													variant="ghost"
												>
													Remove last option
												</Button>
											) : null}
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											checked={draft.allowMultiple}
											id={`poll-multi-${draft.key}`}
											onCheckedChange={(v) =>
												setPollDrafts((prev) =>
													prev.map((d) =>
														d.key === draft.key
															? { ...d, allowMultiple: v === true }
															: d,
													),
												)
											}
										/>
										<Label htmlFor={`poll-multi-${draft.key}`}>
											Allow multiple picks
										</Label>
									</div>
									<Button
										onClick={() =>
											setPollDrafts((prev) =>
												prev.filter((d) => d.key !== draft.key),
											)
										}
										size="sm"
										type="button"
										variant="ghost"
									>
										Remove poll
									</Button>
								</div>
							))}
							{pollDrafts.length < MAX_POLLS_PER_EVENT ? (
								<Button
									onClick={() =>
										setPollDrafts((prev) => [
											...prev,
											{
												allowMultiple: false,
												key: nextPollKey.current++,
												options: [
													{ key: nextOptionKey.current++, value: "" },
													{ key: nextOptionKey.current++, value: "" },
												],
												question: "",
											},
										])
									}
									type="button"
									variant="outline"
								>
									Add a poll
								</Button>
							) : null}
							{fields.polls !== undefined && (
								<p className="text-xs text-destructive">{fields.polls}</p>
							)}
						</fieldset>
						<div className="grid gap-2">
							<Label htmlFor="tz">Time zone</Label>
							<p className="text-xs text-muted-foreground" id={tzHintId}>
								Type to filter the time zones.
							</p>
							<Input
								aria-describedby={tzDescribedBy}
								aria-invalid={fields.timezone !== undefined}
								aria-required="true"
								autoComplete="off"
								id="tz"
								list="tz-list"
								onChange={(e) => setTimezoneOverride(e.target.value)}
								required
								value={timezone}
							/>
							{hydrated ? (
								<datalist id="tz-list">
									{allTimezones().map((tz) => (
										<option key={tz} value={tz} />
									))}
								</datalist>
							) : null}
							{fields.timezone !== undefined && (
								<p className="text-xs text-destructive" id="tz-error">
									{fields.timezone}
								</p>
							)}
						</div>
						{error !== "" && (
							<div
								className="grid gap-1 text-sm text-destructive"
								id="form-error"
								ref={summaryRef}
								role="alert"
								tabIndex={-1}
							>
								<p>{error}</p>
							</div>
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
