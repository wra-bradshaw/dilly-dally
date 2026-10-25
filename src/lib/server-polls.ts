import { and, asc, eq } from "drizzle-orm";
import { type DillyEvent, type DrizzleDb, getParticipantRow } from "./db";
import { generateEventId } from "./event-ids";
import { hashPassword, verifyPassword } from "./password";
import * as schema from "./schema";
import {
	claimUnprotectedParticipant,
	ensureParticipantInsert,
	verifyProtectedAccess,
} from "./server-participant-auth";
import {
	type CreatePollInput,
	MAX_OPTIONS_PER_POLL,
	MAX_POLLS_PER_EVENT,
	nameKey,
	type PollVoteInput,
} from "./validation";

interface PollOptionDetail {
	count: number;
	id: string;
	label: string;
	names: string[];
}

export interface PollDetail {
	allowMultiple: boolean;
	id: string;
	options: PollOptionDetail[];
	question: string;
	totalVoters: number;
}

export async function listPollsDetail(
	db: DrizzleDb,
	eventId: string,
): Promise<PollDetail[]> {
	const pollRows = await db
		.select()
		.from(schema.polls)
		.where(eq(schema.polls.eventId, eventId))
		.orderBy(asc(schema.polls.position));
	if (pollRows.length === 0) return [];
	const optionRows = await db
		.select()
		.from(schema.pollOptions)
		.where(eq(schema.pollOptions.eventId, eventId))
		.orderBy(asc(schema.pollOptions.position));
	const voteRows = await db
		.select()
		.from(schema.pollVotes)
		.where(eq(schema.pollVotes.eventId, eventId));
	const optionsByPoll = new Map<string, typeof optionRows>();
	for (const o of optionRows) {
		const list = optionsByPoll.get(o.pollId);
		if (list) list.push(o);
		else optionsByPoll.set(o.pollId, [o]);
	}
	const votesByOption = new Map<string, typeof voteRows>();
	for (const v of voteRows) {
		const list = votesByOption.get(v.optionId);
		if (list) list.push(v);
		else votesByOption.set(v.optionId, [v]);
	}
	return pollRows.map((p) => {
		const opts = (optionsByPoll.get(p.id) ?? []).map((o) => {
			const votes = votesByOption.get(o.id) ?? [];
			const byKey = new Map<string, string>();
			for (const v of votes) {
				if (!byKey.has(v.nameKey)) byKey.set(v.nameKey, v.nameDisplay);
			}
			const names = [...byKey.values()].sort((a, b) => a.localeCompare(b));
			return { count: byKey.size, id: o.id, label: o.label, names };
		});
		const voters = new Set<string>();
		for (const o of optionsByPoll.get(p.id) ?? []) {
			for (const v of votesByOption.get(o.id) ?? []) voters.add(v.nameKey);
		}
		return {
			allowMultiple: p.allowMultiple === 1,
			id: p.id,
			options: opts,
			question: p.question,
			totalVoters: voters.size,
		};
	});
}

export async function createPollInDb(
	db: DrizzleDb,
	eventId: string,
	input: CreatePollInput,
	now: number,
): Promise<{ ok: true; poll: PollDetail } | { code: string; ok: false }> {
	const existing = await db
		.select()
		.from(schema.polls)
		.where(eq(schema.polls.eventId, eventId));
	if (existing.length >= MAX_POLLS_PER_EVENT)
		return { code: "too_many_polls", ok: false };
	const qKey = input.question.trim().toLowerCase();
	if (existing.some((p) => p.question.trim().toLowerCase() === qKey))
		return { code: "duplicate_question", ok: false };
	const seen = new Set<string>();
	for (const raw of input.options) {
		const k = raw.trim().toLowerCase();
		if (seen.has(k)) return { code: "duplicate_option", ok: false };
		seen.add(k);
	}
	const pollId = generateEventId();
	const position =
		existing.length === 0
			? 0
			: Math.max(...existing.map((p) => p.position)) + 1;
	try {
		await db.insert(schema.polls).values({
			allowMultiple: input.allowMultiple ? 1 : 0,
			createdAt: now,
			eventId,
			id: pollId,
			position,
			question: input.question.trim(),
		});
		const labels = input.options.map((o) => o.trim());
		await db.insert(schema.pollOptions).values(
			labels.map((label, i) => ({
				createdAt: now,
				eventId,
				id: generateEventId(),
				label,
				pollId,
				position: i,
			})),
		);
	} catch (err) {
		await db.delete(schema.polls).where(eq(schema.polls.id, pollId));
		throw err;
	}
	const detail = await listPollsDetail(db, eventId);
	const poll = detail.find((p) => p.id === pollId);
	if (!poll) return { code: "not_found", ok: false };
	return { ok: true, poll };
}

export async function addPollOptionInDb(
	db: DrizzleDb,
	eventId: string,
	pollId: string,
	label: string,
	now: number,
): Promise<{ ok: true; optionId: string } | { code: string; ok: false }> {
	const pollRows = await db
		.select()
		.from(schema.polls)
		.where(and(eq(schema.polls.id, pollId), eq(schema.polls.eventId, eventId)));
	const poll = pollRows[0];
	if (!poll) return { code: "not_found", ok: false };
	const options = await db
		.select()
		.from(schema.pollOptions)
		.where(eq(schema.pollOptions.pollId, pollId));
	if (options.length >= MAX_OPTIONS_PER_POLL)
		return { code: "too_many_options", ok: false };
	const key = label.trim().toLowerCase();
	if (options.some((o) => o.label.trim().toLowerCase() === key))
		return { code: "duplicate_option", ok: false };
	const optionId = generateEventId();
	const position =
		options.length === 0 ? 0 : Math.max(...options.map((o) => o.position)) + 1;
	await db.insert(schema.pollOptions).values({
		createdAt: now,
		eventId,
		id: optionId,
		label: label.trim(),
		pollId,
		position,
	});
	return { ok: true, optionId };
}

export async function deletePollOptionInDb(
	db: DrizzleDb,
	eventId: string,
	pollId: string,
	optionId: string,
): Promise<{ ok: true } | { code: string; ok: false }> {
	const optionRows = await db
		.select()
		.from(schema.pollOptions)
		.where(
			and(
				eq(schema.pollOptions.id, optionId),
				eq(schema.pollOptions.pollId, pollId),
				eq(schema.pollOptions.eventId, eventId),
			),
		);
	if (optionRows.length === 0) return { code: "not_found", ok: false };
	const allOptions = await db
		.select({ id: schema.pollOptions.id })
		.from(schema.pollOptions)
		.where(eq(schema.pollOptions.pollId, pollId));
	if (allOptions.length <= 2) return { code: "too_few_options", ok: false };
	const votes = await db
		.select({ optionId: schema.pollVotes.optionId })
		.from(schema.pollVotes)
		.where(eq(schema.pollVotes.optionId, optionId));
	if (votes.length > 0) return { code: "has_votes", ok: false };
	await db
		.delete(schema.pollOptions)
		.where(eq(schema.pollOptions.id, optionId));
	return { ok: true };
}

export async function votePollInDb(
	db: DrizzleDb,
	event: DillyEvent,
	pollId: string,
	input: PollVoteInput,
	now: number = Date.now(),
	deps: {
		hash: typeof hashPassword;
		verify: typeof verifyPassword;
	} = { hash: hashPassword, verify: verifyPassword },
	opts: { sessionNameKey?: string } = {},
): Promise<{ ok: true } | { code: string; ok: false }> {
	const pollPromise = db
		.select()
		.from(schema.polls)
		.where(
			and(eq(schema.polls.id, pollId), eq(schema.polls.eventId, event.id)),
		);
	const existingPromise = getParticipantRow(db, event.id, nameKey(input.name));
	const [pollRows, existing] = await Promise.all([
		pollPromise,
		existingPromise,
	]);
	const poll = pollRows[0];
	if (!poll) return { code: "not_found", ok: false };
	const options = await db
		.select()
		.from(schema.pollOptions)
		.where(eq(schema.pollOptions.pollId, pollId));
	const validIds = new Set(options.map((o) => o.id));
	const uniqueIds = [...new Set(input.optionIds)];
	for (const id of uniqueIds) {
		if (!validIds.has(id)) return { code: "invalid_option", ok: false };
	}
	if (!poll.allowMultiple && uniqueIds.length > 1)
		return { code: "invalid_selection", ok: false };
	const key = nameKey(input.name);
	const display = input.name.trim();
	const sessionAuthenticated =
		opts.sessionNameKey !== undefined && opts.sessionNameKey === key;
	if (existing?.passwordHash) {
		const checked = await verifyProtectedAccess(
			input.password,
			existing.passwordHash,
			deps,
			sessionAuthenticated,
		);
		if (!checked.ok) return checked;
	} else if (existing && !existing.passwordHash) {
		if (input.password && !sessionAuthenticated) {
			const passwordHash = await deps.hash(input.password);
			const claimed = await claimUnprotectedParticipant(
				db,
				event.id,
				key,
				passwordHash,
				now,
			);
			if (!claimed.ok) return claimed;
		}
	} else if (!existing && input.password) {
		const ensured = await ensureParticipantInsert(
			db,
			event.id,
			display,
			key,
			input.password,
			{
				deps,
				now,
				sessionAuthenticated,
				slotsJson: JSON.stringify([]),
			},
		);
		if (!ensured.ok) return ensured;
		if (!ensured.row.passwordHash && ensured.candidateHash) {
			const claimed = await claimUnprotectedParticipant(
				db,
				event.id,
				key,
				ensured.candidateHash,
				now,
			);
			if (!claimed.ok) return claimed;
		}
	}
	await db
		.delete(schema.pollVotes)
		.where(
			and(
				eq(schema.pollVotes.pollId, pollId),
				eq(schema.pollVotes.nameKey, key),
			),
		);
	if (uniqueIds.length > 0) {
		await db.insert(schema.pollVotes).values(
			uniqueIds.map((optionId) => ({
				eventId: event.id,
				nameDisplay: display,
				nameKey: key,
				optionId,
				pollId,
				updatedAt: now,
			})),
		);
	}
	return { ok: true };
}
