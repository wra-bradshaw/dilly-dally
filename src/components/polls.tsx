import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useRef, useState } from "react";
import {
	addPollOption,
	createPoll,
	deletePollOption,
	type EventDetailResponse,
	type Poll,
	votePoll,
} from "#/lib/client";
import {
	patchDetailForDeleteOption,
	patchDetailForNewOption,
	patchDetailForNewPoll,
	patchDetailForPollVote,
} from "#/lib/detail-patch";
import { HttpError } from "#/lib/http-error";
import {
	MAX_OPTIONS_PER_POLL,
	MAX_POLLS_PER_EVENT,
	nameKey,
} from "#/lib/validation";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

type PollsSectionProps = {
	activeName: string;
	eventId: string;
	password: string;
	polls: Poll[];
	signedIn: boolean;
};

function voteErrorMessage(err: unknown): string {
	if (err instanceof HttpError && err.code === "invalid_password")
		return "Wrong password for this name.";
	if (err instanceof HttpError && err.code === "invalid_option")
		return "That selection is no longer valid. Reloading.";
	return "Could not save vote. Try again.";
}

function PollCard({
	activeName,
	eventId,
	password,
	poll,
	signedIn,
}: {
	activeName: string;
	eventId: string;
	password: string;
	poll: Poll;
	signedIn: boolean;
}) {
	const queryClient = useQueryClient();
	const [optionDraft, setOptionDraft] = useState("");
	const [optionError, setOptionError] = useState("");
	const [optionSaving, setOptionSaving] = useState(false);
	const [voteError, setVoteError] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const newOptionId = useId();
	const voteGroupId = useId();
	const activeKey = nameKey(activeName);
	const ownIds = useMemo(() => {
		const ids = new Set<string>();
		for (const o of poll.options) {
			if (o.names.some((n) => nameKey(n) === activeKey)) ids.add(o.id);
		}
		return ids;
	}, [poll.options, activeKey]);
	const voteMutation = useMutation({
		mutationFn: (optionIds: string[]) =>
			votePoll(eventId, poll.id, {
				name: activeName,
				optionIds,
				password: password === "" ? undefined : password,
			}),
		onError: (err, _next, ctx) => {
			setVoteError(voteErrorMessage(err));
			const prev = (ctx as { prev?: EventDetailResponse } | undefined)?.prev;
			if (prev) queryClient.setQueryData(["event", eventId], prev);
			if (err instanceof HttpError && err.code === "invalid_option") {
				void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
			}
		},
		onMutate: async (next: string[]) => {
			setVoteError("");
			await queryClient.cancelQueries({ queryKey: ["event", eventId] });
			const prev = queryClient.getQueryData<EventDetailResponse>([
				"event",
				eventId,
			]);
			queryClient.setQueryData(
				["event", eventId],
				(old: EventDetailResponse | undefined) =>
					old ? patchDetailForPollVote(old, poll.id, activeName, next) : old,
			);
			return { prev };
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
		},
	});
	const readOwnIds = () => {
		const cached = queryClient.getQueryData<EventDetailResponse>([
			"event",
			eventId,
		]);
		const current = cached?.polls.find((q) => q.id === poll.id) ?? poll;
		const ids = new Set<string>();
		for (const o of current.options) {
			if (o.names.some((n) => nameKey(n) === activeKey)) ids.add(o.id);
		}
		return ids;
	};
	const commit = (next: string[]) => {
		if (!signedIn || activeName === "") return;
		voteMutation.mutate(next);
	};
	const toggleMulti = (optionId: string) => {
		const next = readOwnIds();
		if (next.has(optionId)) next.delete(optionId);
		else next.add(optionId);
		commit([...next]);
	};
	const pickSingle = (optionId: string) => {
		const current = readOwnIds();
		if (current.has(optionId) && current.size === 1) return;
		commit([optionId]);
	};
	const clearVote = () => {
		commit([]);
	};
	const submitOption = async () => {
		if (!signedIn) {
			setOptionError("Sign in to add options.");
			return;
		}
		const label = optionDraft.trim();
		setOptionError("");
		if (label === "") {
			setOptionError("Enter an option label.");
			return;
		}
		if (poll.options.length >= MAX_OPTIONS_PER_POLL) {
			setOptionError(`This poll already has ${MAX_OPTIONS_PER_POLL} options.`);
			return;
		}
		if (
			poll.options.some(
				(o) => o.label.trim().toLowerCase() === label.toLowerCase(),
			)
		) {
			setOptionError("This option already exists.");
			return;
		}
		setOptionSaving(true);
		try {
			const res = await addPollOption(eventId, poll.id, { label });
			queryClient.setQueryData(
				["event", eventId],
				(old: EventDetailResponse | undefined) =>
					old ? patchDetailForNewOption(old, poll.id, res) : old,
			);
			setOptionDraft("");
			void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
		} catch (err) {
			if (err instanceof HttpError && err.code === "duplicate_option")
				setOptionError("This option already exists.");
			else if (err instanceof HttpError && err.code === "too_many_options")
				setOptionError(
					`This poll already has ${MAX_OPTIONS_PER_POLL} options.`,
				);
			else setOptionError("Could not add option. Try again.");
		} finally {
			setOptionSaving(false);
		}
	};
	const removeOption = async (optionId: string) => {
		if (!signedIn) {
			setOptionError("Sign in to remove options.");
			return;
		}
		setDeletingId(optionId);
		setOptionError("");
		try {
			await deletePollOption(eventId, poll.id, optionId);
			queryClient.setQueryData(
				["event", eventId],
				(old: EventDetailResponse | undefined) =>
					old ? patchDetailForDeleteOption(old, poll.id, optionId) : old,
			);
			void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
		} catch (err) {
			if (err instanceof HttpError && err.code === "has_votes")
				setOptionError("Cannot remove an option that already has votes.");
			else if (err instanceof HttpError && err.code === "too_few_options")
				setOptionError("Polls need at least two options.");
			else setOptionError("Could not remove option. Try again.");
		} finally {
			setDeletingId(null);
		}
	};
	const singleValue = poll.allowMultiple ? undefined : ([...ownIds][0] ?? "");
	return (
		<Card>
			<CardHeader>
				<CardTitle level={3}>{poll.question}</CardTitle>
			</CardHeader>
			<CardContent>
				{signedIn ? null : (
					<p className="mb-2 text-sm text-muted-foreground">Sign in to vote.</p>
				)}
				{poll.allowMultiple ? (
					<fieldset className="grid gap-2">
						<legend className="sr-only">{poll.question}</legend>
						{poll.options.map((o) => (
							<div className="flex items-start gap-2" key={o.id}>
								<Checkbox
									aria-label={`${o.label}, ${o.count} votes`}
									checked={ownIds.has(o.id)}
									disabled={!signedIn}
									id={`${voteGroupId}-${o.id}`}
									onCheckedChange={() => toggleMulti(o.id)}
								/>
								<div className="grid flex-1 gap-0.5">
									<Label htmlFor={`${voteGroupId}-${o.id}`}>
										{o.label} · {o.count}
									</Label>
									{o.names.length > 0 ? (
										<p className="text-xs text-muted-foreground">
											{o.names.join(", ")}
										</p>
									) : null}
								</div>
								{o.count === 0 && signedIn && poll.options.length > 2 ? (
									<Button
										aria-label={`Remove ${o.label}`}
										disabled={deletingId !== null}
										onClick={() => void removeOption(o.id)}
										size="xs"
										type="button"
										variant="ghost"
									>
										{deletingId === o.id ? "…" : "Remove"}
									</Button>
								) : null}
							</div>
						))}
					</fieldset>
				) : (
					<RadioGroup
						aria-label={poll.question}
						onValueChange={pickSingle}
						value={singleValue ?? ""}
					>
						{poll.options.map((o) => (
							<div className="flex items-start gap-2" key={o.id}>
								<RadioGroupItem
									aria-label={`${o.label}, ${o.count} votes`}
									disabled={!signedIn}
									id={`${voteGroupId}-${o.id}`}
									value={o.id}
								/>
								<div className="grid flex-1 gap-0.5">
									<Label htmlFor={`${voteGroupId}-${o.id}`}>
										{o.label} · {o.count}
									</Label>
									{o.names.length > 0 ? (
										<p className="text-xs text-muted-foreground">
											{o.names.join(", ")}
										</p>
									) : null}
								</div>
								{o.count === 0 && signedIn && poll.options.length > 2 ? (
									<Button
										aria-label={`Remove ${o.label}`}
										disabled={deletingId !== null}
										onClick={() => void removeOption(o.id)}
										size="xs"
										type="button"
										variant="ghost"
									>
										{deletingId === o.id ? "…" : "Remove"}
									</Button>
								) : null}
							</div>
						))}
					</RadioGroup>
				)}
				{voteError !== "" ? (
					<p className="mt-2 text-sm text-destructive" role="alert">
						{voteError}
					</p>
				) : null}
				{voteMutation.isPending ? (
					<p aria-live="polite" className="mt-2 text-xs text-muted-foreground">
						Saving…
					</p>
				) : null}
				{signedIn && ownIds.size > 0 ? (
					<Button
						disabled={!signedIn}
						className="mt-2 h-auto min-h-6 p-0 text-sm"
						onClick={clearVote}
						type="button"
						variant="link"
					>
						Clear my vote
					</Button>
				) : null}
				<div className="mt-3 grid gap-2 border-t pt-3">
					<Label htmlFor={newOptionId}>Add an option</Label>
					<div className="flex gap-2">
						<Input
							id={newOptionId}
							maxLength={80}
							onChange={(e) => setOptionDraft(e.target.value)}
							placeholder="New option"
							value={optionDraft}
						/>
						<Button
							disabled={
								optionSaving || poll.options.length >= MAX_OPTIONS_PER_POLL
							}
							onClick={() => void submitOption()}
							type="button"
						>
							{optionSaving ? "Adding…" : "Add"}
						</Button>
					</div>
					{optionError !== "" ? (
						<p className="text-xs text-destructive" role="alert">
							{optionError}
						</p>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

function AddPollForm({
	eventId,
	onCreated,
	signedIn,
}: {
	eventId: string;
	onCreated: () => void;
	signedIn: boolean;
}) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [question, setQuestion] = useState("");
	const nextKey = useRef(2);
	const [options, setOptions] = useState<Array<{ key: number; value: string }>>(
		[
			{ key: 0, value: "" },
			{ key: 1, value: "" },
		],
	);
	const [allowMultiple, setAllowMultiple] = useState(false);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const questionId = useId();
	const multiId = useId();
	if (!open) {
		if (!signedIn) return null;
		return (
			<Button onClick={() => setOpen(true)} type="button" variant="outline">
				Add a poll
			</Button>
		);
	}
	const setOption = (key: number, value: string) => {
		setOptions((prev) =>
			prev.map((o) => (o.key === key ? { ...o, value } : o)),
		);
	};
	const submit = async () => {
		setError("");
		const q = question.trim();
		const labels = options.map((o) => o.value.trim()).filter((o) => o !== "");
		if (q === "") {
			setError("Give the poll a question.");
			return;
		}
		if (labels.length < 2) {
			setError("Add at least two options.");
			return;
		}
		if (labels.length > MAX_OPTIONS_PER_POLL) {
			setError(`Polls have at most ${MAX_OPTIONS_PER_POLL} options.`);
			return;
		}
		const seen = new Set<string>();
		for (const l of labels) {
			const k = l.toLowerCase();
			if (seen.has(k)) {
				setError("Poll options must be unique.");
				return;
			}
			seen.add(k);
		}
		setSaving(true);
		try {
			const res = await createPoll(eventId, {
				allowMultiple,
				options: labels,
				question: q,
			});
			queryClient.setQueryData(
				["event", eventId],
				(old: EventDetailResponse | undefined) =>
					old ? patchDetailForNewPoll(old, res.poll) : old,
			);
			setQuestion("");
			setOptions([
				{ key: nextKey.current++, value: "" },
				{ key: nextKey.current++, value: "" },
			]);
			setAllowMultiple(false);
			setOpen(false);
			onCreated();
			void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
		} catch (err) {
			if (err instanceof HttpError && err.code === "duplicate_poll")
				setError("A poll with this question already exists.");
			else if (err instanceof HttpError && err.code === "too_many_polls")
				setError(`This event already has ${MAX_POLLS_PER_EVENT} polls.`);
			else setError("Could not create poll. Try again.");
		} finally {
			setSaving(false);
		}
	};
	return (
		<Card>
			<CardHeader>
				<CardTitle level={3}>New poll</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="grid gap-2">
					<Label htmlFor={questionId}>Question</Label>
					<Input
						id={questionId}
						maxLength={140}
						onChange={(e) => setQuestion(e.target.value)}
						placeholder="Where should we eat?"
						value={question}
					/>
				</div>
				<fieldset className="grid gap-2">
					<legend className="text-xs leading-none">Options</legend>
					{options.map((o, idx) => (
						<Input
							aria-label={`Option ${idx + 1}`}
							key={o.key}
							maxLength={80}
							onChange={(e) => setOption(o.key, e.target.value)}
							placeholder={`Option ${idx + 1}`}
							value={o.value}
						/>
					))}
					{options.length < MAX_OPTIONS_PER_POLL ? (
						<Button
							onClick={() =>
								setOptions((prev) => [
									...prev,
									{ key: nextKey.current++, value: "" },
								])
							}
							size="sm"
							type="button"
							variant="outline"
						>
							Add option field
						</Button>
					) : null}
				</fieldset>
				<div className="flex items-center gap-2">
					<Checkbox
						checked={allowMultiple}
						id={multiId}
						onCheckedChange={(v) => setAllowMultiple(v === true)}
					/>
					<Label htmlFor={multiId}>Allow multiple picks</Label>
				</div>
				{error !== "" ? (
					<p className="text-xs text-destructive" role="alert">
						{error}
					</p>
				) : null}
				<div className="flex gap-2">
					<Button disabled={saving} onClick={() => void submit()} type="button">
						{saving ? "Creating…" : "Create poll"}
					</Button>
					<Button
						onClick={() => {
							setOpen(false);
							setError("");
						}}
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export function PollsSection({
	activeName,
	eventId,
	password,
	polls,
	signedIn,
}: PollsSectionProps) {
	const queryClient = useQueryClient();
	if (polls.length === 0) {
		return (
			<div className="mt-4 grid gap-3">
				<div className="flex items-center justify-between">
					<h2 className="font-heading text-sm font-medium">Polls</h2>
				</div>
				<p className="text-sm text-muted-foreground">
					No polls yet. Ask where to eat, which day, anything.
				</p>
				<div>
					{signedIn ? (
						<AddPollForm
							eventId={eventId}
							onCreated={() =>
								void queryClient.invalidateQueries({
									queryKey: ["event", eventId],
								})
							}
							signedIn={signedIn}
						/>
					) : (
						<p className="text-sm text-muted-foreground">
							Sign in to add a poll.
						</p>
					)}
				</div>
			</div>
		);
	}
	return (
		<div className="mt-4 grid gap-3">
			<div className="flex items-center justify-between">
				<h2 className="font-heading text-sm font-medium">Polls</h2>
				<span className="text-xs text-muted-foreground">
					{polls.length} {polls.length === 1 ? "poll" : "polls"}
				</span>
			</div>
			<div
				className={
					polls.length > 1 ? "grid gap-3 md:grid-cols-2" : "grid gap-3"
				}
			>
				{polls.map((p) => (
					<PollCard
						activeName={activeName}
						eventId={eventId}
						key={p.id}
						password={password}
						poll={p}
						signedIn={signedIn}
					/>
				))}
			</div>
			<div>
				{signedIn ? (
					polls.length >= MAX_POLLS_PER_EVENT ? (
						<p className="text-sm text-muted-foreground">
							This event already has {MAX_POLLS_PER_EVENT} polls.
						</p>
					) : (
						<AddPollForm
							eventId={eventId}
							onCreated={() =>
								void queryClient.invalidateQueries({
									queryKey: ["event", eventId],
								})
							}
							signedIn={signedIn}
						/>
					)
				) : (
					<p className="text-sm text-muted-foreground">
						Sign in to add a poll.
					</p>
				)}
			</div>
		</div>
	);
}
