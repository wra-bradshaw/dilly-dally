import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import type { ReactNode } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { usePendingIds } from "#/hooks/use-pending-ids";
import {
	addPollOption,
	createPoll,
	deletePollOption,
	type EventDetailResponse,
	type Poll,
	votePoll,
} from "#/lib/client";
import { patchDetailForPollVote } from "#/lib/detail-patch";
import {
	pollCreateErrorMessage,
	pollOptionErrorMessage,
	pollVoteErrorMessage,
} from "#/lib/event-messages";
import {
	MAX_OPTIONS_PER_POLL,
	MAX_POLLS_PER_EVENT,
	nameKey,
} from "#/lib/validation";
import {
	patchDetailForDeleteOption,
	patchDetailForNewOption,
	patchDetailForNewPoll,
} from "./polls/poll-patch";
import {
	ownIdsForName,
	validateNewOptionLabel,
	validatePollDraft,
	voteShare,
} from "./polls/poll-utils";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
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

function PollOptionRow({
	control,
	count,
	htmlFor,
	label,
	names,
	remove,
	selected,
	share,
}: {
	control: ReactNode;
	count: number;
	htmlFor: string;
	label: string;
	names: string[];
	remove: ReactNode;
	selected: boolean;
	share: number;
}) {
	const voters = names.length > 0 ? names.join(", ") : "No votes yet";
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-none border transition-colors",
				selected ? "border-primary/60" : "border-border",
			)}
		>
			<div
				aria-hidden="true"
				className={cn(
					"absolute inset-y-0 left-0 transition-[width] duration-300",
					selected ? "bg-primary/[0.14]" : "bg-primary/[0.07]",
				)}
				data-testid={`poll-share-${htmlFor}`}
				style={{ width: `${Math.min(100, share)}%` }}
			/>
			<div className="relative flex items-start">
				<Label
					className="grid min-w-0 flex-1 cursor-pointer gap-0.5 px-2.5 py-2"
					htmlFor={htmlFor}
				>
					<span className="flex items-start gap-2.5">
						<span className="shrink-0 pt-0.5">{control}</span>
						<span className="grid min-w-0 flex-1 gap-0.5">
							<span className="flex items-baseline justify-between gap-2">
								<span className="min-w-0 flex-1 truncate text-[13px] font-medium">
									{label}
								</span>
								<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
									{count} · {share}%
								</span>
							</span>
							<span
								className={cn(
									"truncate text-xs select-text",
									names.length > 0
										? "text-muted-foreground"
										: "text-muted-foreground/70 italic",
								)}
								title={names.length > 0 ? voters : undefined}
							>
								{voters}
							</span>
						</span>
					</span>
				</Label>
				{remove ? <span className="shrink-0 py-2 pr-2.5">{remove}</span> : null}
			</div>
		</div>
	);
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
	const ownIds = useMemo(
		() => ownIdsForName(poll.options, activeName, nameKey),
		[poll.options, activeName],
	);
	const pending = usePendingIds<string[]>();
	const displayIds = useMemo(
		() => new Set(pending.pendingIds ?? [...ownIds]),
		[pending.pendingIds, ownIds],
	);
	const voteMutation = useMutation<
		{ pollId: string },
		unknown,
		{ identity: string; optionIds: string[]; password?: string },
		{ prev?: EventDetailResponse; version: number }
	>({
		mutationFn: (value) =>
			votePoll(eventId, poll.id, {
				name: value.identity,
				optionIds: value.optionIds,
				password: value.password,
			}),
		mutationKey: ["poll-vote", eventId, poll.id],
		onError: (err, _variables, ctx) => {
			setVoteError(pollVoteErrorMessage(err));
			if (ctx?.prev) queryClient.setQueryData(["event", eventId], ctx.prev);
		},
		onMutate: async (variables) => {
			setVoteError("");
			const version = pending.getVersion();
			await queryClient.cancelQueries({ queryKey: ["event", eventId] });
			const prev = queryClient.getQueryData<EventDetailResponse>([
				"event",
				eventId,
			]);
			queryClient.setQueryData(
				["event", eventId],
				(old: EventDetailResponse | undefined) =>
					old
						? patchDetailForPollVote(
								old,
								poll.id,
								variables.identity,
								variables.optionIds,
							)
						: old,
			);
			return { prev, version };
		},
		onSettled: (_data, _err, _vars, ctx) => {
			if (ctx) pending.resolve(ctx.version);
			else pending.clear();
			return queryClient.invalidateQueries({ queryKey: ["event", eventId] });
		},
		onSuccess: () => {
			setVoteError("");
		},
		scope: { id: `poll-vote-${eventId}-${poll.id}` },
	});
	const commit = (next: string[]) => {
		if (!signedIn || activeName === "") return;
		pending.commit(next);
		voteMutation.mutate({
			identity: activeName,
			optionIds: next,
			password: password === "" ? undefined : password,
		});
	};
	const toggleMulti = (optionId: string) => {
		const next = new Set(displayIds);
		if (next.has(optionId)) next.delete(optionId);
		else next.add(optionId);
		commit([...next]);
	};
	const pickSingle = (optionId: string) => {
		if (displayIds.has(optionId) && displayIds.size === 1) return;
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
		const optionProblem = validateNewOptionLabel(
			label,
			poll.options,
			MAX_OPTIONS_PER_POLL,
		);
		if (optionProblem !== null) {
			setOptionError(optionProblem);
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
			setOptionError(pollOptionErrorMessage(err, "add"));
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
			setOptionError(pollOptionErrorMessage(err, "remove"));
		} finally {
			setDeletingId(null);
		}
	};
	const singleValue = poll.allowMultiple
		? undefined
		: ([...displayIds][0] ?? "");
	const removeButton = (o: { id: string; label: string; count: number }) =>
		o.count === 0 && signedIn && poll.options.length > 2 ? (
			<Button
				aria-label={`Remove ${o.label}`}
				className="shrink-0"
				disabled={deletingId !== null}
				onClick={() => void removeOption(o.id)}
				size="xs"
				type="button"
				variant="ghost"
			>
				{deletingId === o.id ? "…" : "Remove"}
			</Button>
		) : null;
	return (
		<Card className="min-w-0 max-w-full">
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
							<PollOptionRow
								control={
									<Checkbox
										aria-label={`${o.label}, ${o.count} votes, ${voteShare(o.count, poll.totalVoters)} percent`}
										checked={displayIds.has(o.id)}
										disabled={!signedIn}
										id={`${voteGroupId}-${o.id}`}
										onCheckedChange={() => toggleMulti(o.id)}
									/>
								}
								count={o.count}
								htmlFor={`${voteGroupId}-${o.id}`}
								key={o.id}
								label={o.label}
								names={o.names}
								remove={removeButton(o)}
								selected={displayIds.has(o.id)}
								share={voteShare(o.count, poll.totalVoters)}
							/>
						))}
					</fieldset>
				) : (
					<RadioGroup
						aria-label={poll.question}
						onValueChange={pickSingle}
						value={singleValue ?? ""}
					>
						{poll.options.map((o) => (
							<PollOptionRow
								control={
									<RadioGroupItem
										aria-label={`${o.label}, ${o.count} votes, ${voteShare(o.count, poll.totalVoters)} percent`}
										disabled={!signedIn}
										id={`${voteGroupId}-${o.id}`}
										value={o.id}
									/>
								}
								count={o.count}
								htmlFor={`${voteGroupId}-${o.id}`}
								key={o.id}
								label={o.label}
								names={o.names}
								remove={removeButton(o)}
								selected={displayIds.has(o.id)}
								share={voteShare(o.count, poll.totalVoters)}
							/>
						))}
					</RadioGroup>
				)}
				{voteError !== "" ? (
					<p className="mt-2 text-sm text-destructive" role="alert">
						{voteError}
					</p>
				) : null}
				<p
					aria-live="polite"
					className="mt-2 min-h-4 text-xs text-muted-foreground"
				>
					{voteMutation.isPending ? "Saving…" : ""}
				</p>
				{signedIn && displayIds.size > 0 ? (
					<Button
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
		const draftProblem = validatePollDraft(q, labels, MAX_OPTIONS_PER_POLL);
		if (draftProblem !== null) {
			setError(draftProblem);
			return;
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
			setError(pollCreateErrorMessage(err));
		} finally {
			setSaving(false);
		}
	};
	return (
		<Card className="min-w-0 max-w-full">
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
	const onCreated = () =>
		void queryClient.invalidateQueries({ queryKey: ["event", eventId] });
	return (
		<div className="mt-4 grid gap-3">
			<div className="flex items-center justify-between">
				<h2 className="font-heading text-sm font-medium">Polls</h2>
				{polls.length === 0 ? null : (
					<span className="text-xs text-muted-foreground">
						{polls.length} {polls.length === 1 ? "poll" : "polls"}
					</span>
				)}
			</div>
			{polls.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No polls yet. Ask where to eat, which day, anything.
				</p>
			) : (
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
			)}
			<div>
				{signedIn ? (
					polls.length >= MAX_POLLS_PER_EVENT ? (
						<p className="text-sm text-muted-foreground">
							This event already has {MAX_POLLS_PER_EVENT} polls.
						</p>
					) : (
						<AddPollForm
							eventId={eventId}
							onCreated={onCreated}
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
