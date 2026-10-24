import { docsResponse, originOf } from "./api-errors";
import type { EventDetailResponse } from "./client";

export function agentGuideResponse(request: Request): Response {
	const guide = AGENT_GUIDE_MARKDOWN.replaceAll("HOST", originOf(request));
	const res = docsResponse(guide, "text/markdown; charset=utf-8");
	res.headers.set("Cache-Control", "no-store");
	res.headers.set("Vary", "Accept, User-Agent");
	return res;
}

export function llmsResponse(): Response {
	return docsResponse(LLMS_TEXT, "text/plain; charset=utf-8");
}

export function eventDetailMarkdownResponse(
	detail: EventDetailResponse,
	origin: string,
	eventId: string,
): Response {
	return new Response(renderEventMarkdown(detail, origin, eventId), {
		headers: {
			...docsHeaders(),
			"Cache-Control": "no-store",
			"Content-Type": "text/markdown; charset=utf-8",
		},
	});
}

export function markdownErrorResponse(
	title: string,
	hint: string,
	status: number,
): Response {
	return new Response(`# ${title}\n\n${hint}\n`, {
		headers: {
			...docsHeaders(),
			"Cache-Control": "no-store",
			"Content-Type": "text/markdown; charset=utf-8",
		},
		status,
	});
}

function docsHeaders(): Record<string, string> {
	return {
		"Referrer-Policy": "strict-origin-when-cross-origin",
		Vary: "Accept, User-Agent",
		"X-Content-Type-Options": "nosniff",
	};
}

export function renderEventMarkdown(
	detail: EventDetailResponse,
	origin: string,
	eventId: string,
): string {
	const lines: string[] = [];
	const event = detail.event;
	const canonicalId = event.id !== "" ? event.id : eventId;
	const inviteUrl = `${origin}/e/${canonicalId}`;
	lines.push(`# ${oneLine(event.title)}`);
	lines.push("");
	lines.push(`Invite: ${inviteUrl}`);
	lines.push(`Timezone: ${event.timezone}`);
	lines.push(
		`Mode: ${event.mode === "weekly" ? `weekly (${event.weekdays.join(", ")})` : "specific dates"}`,
	);
	lines.push(
		`Window: ${event.startTime} no earlier, ${event.endTime} no later`,
	);
	lines.push("");
	if (detail.bestTimes.length > 0) {
		lines.push("## Best times");
		lines.push("");
		for (const best of detail.bestTimes) {
			lines.push(`- ${best.slot} (${best.count})`);
		}
		lines.push("");
	}
	lines.push("## Availability");
	lines.push("");
	if (detail.counts.length === 0) {
		lines.push("No availability yet.");
	} else {
		for (const entry of detail.counts) {
			const names =
				entry.names.length > 0
					? ` (${entry.names.map(oneLine).join(", ")})`
					: "";
			lines.push(`- ${entry.slot}: ${entry.count}${names}`);
		}
	}
	lines.push("");
	if (detail.polls.length > 0) {
		lines.push("## Polls");
		lines.push("");
		for (const poll of detail.polls) {
			lines.push(
				`### ${oneLine(poll.question)} (poll ${poll.id}, ${poll.totalVoters} voters${poll.allowMultiple ? ", multiple picks" : ""})`,
			);
			for (const option of poll.options) {
				const names =
					option.names.length > 0
						? ` (${option.names.map(oneLine).join(", ")})`
						: "";
				lines.push(
					`- ${oneLine(option.label)} (option ${option.id}): ${option.count}${names}`,
				);
			}
			lines.push("");
		}
	}
	lines.push("## For agents");
	lines.push("");
	lines.push(
		"Read and write via JSON; see `GET /api/openapi.json` for schemas.",
	);
	lines.push(
		`Full guide with curl flows: \`GET ${origin}/ with Accept: text/markdown\`.`,
	);
	lines.push(`- Read detail: \`GET ${origin}/api/events/${canonicalId}\``);
	lines.push(
		`- Save availability: \`PUT ${origin}/api/events/${canonicalId}/availability\``,
	);
	lines.push(
		`- Vote: \`PUT ${origin}/api/events/${canonicalId}/polls/:pollId/vote\``,
	);
	lines.push("");
	return lines.join("\n");
}

function oneLine(value: string): string {
	return value.replace(/[\r\n]+/g, " ").trim();
}
export const LLMS_TEXT = `Dilly-Dally: agent-friendly when2meet replacement. No login.
- Pages serve Markdown to agents: send Accept: text/markdown (curl and scripts get it automatically) on / and /e/:id.
- Full guide: GET / with Accept: text/markdown
- Create events: POST /api/events
- Availability: PUT /api/events/:id/availability
- Polls: POST /api/events/:id/polls, POST /api/events/:id/polls/:pollId/options, PUT /api/events/:id/polls/:pollId/vote
- OpenAPI 3.1: /api/openapi.json
`;

export const AGENT_GUIDE_MARKDOWN = `# Dilly-Dally Agent Guide

Dilly-Dally is an agent-friendly when2meet replacement. No login. Two curl calls cover the full flow.

Base URL: the origin you were given, for example \`https://dilly-dally.example.com\`. Replace \`HOST\` below.

## 1. Create an event

\`\`\`sh
curl -X POST HOST/api/events \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "Team offsite",
    "dates": ["2026-10-05", "2026-10-06"],
    "startTime": "09:00",
    "endTime": "17:00",
    "timezone": "America/New_York"
  }'
\`\`\`

Response (201):

\`\`\`json
{ "id": "AbC123_-XyZ9", "url": "HOST/e/AbC123_-XyZ9", "event": { "title": "Team offsite" } }
\`\`\`

Show the \`url\` to your user. That URL is the event. It stays live until the event passes, max 90 days, then it is deleted.

Rules:
- \`title\` 1..100 chars.
- \`dates\` 1..31 entries, \`YYYY-MM-DD\`, today or future, within 90 days.
- \`startTime\` / \`endTime\` hour-only \`HH:00\`, \`startTime < endTime\`.
- \`timezone\` valid IANA, for example \`America/New_York\`.

## 1b. Create a weekly recurring event

Weekly events repeat on weekdays instead of specific dates. Availability means "that weekday generally".

\`\`\`sh
curl -X POST HOST/api/events \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "Weekly standup",
    "mode": "weekly",
    "weekdays": [1, 3, 5],
    "startTime": "09:00",
    "endTime": "10:00",
    "timezone": "America/New_York"
  }'
\`\`\`

Rules:
- \`mode\` is \`"dates"\` (default) or \`"weekly"\`.
- \`weekdays\` 1..7 unique entries, \`0\`=Sunday through \`6\`=Saturday, so \`[1,3,5]\` means Mon/Wed/Fri.
- Weekly events stay live 90 days from creation.
- Weekly slots look like \`MON-09:30\`. Paint them with the same availability call, for example \`"slots": ["MON-09:00", "WED-09:30"]\`.
- Date slots (\`2026-10-05T09:00\`) are rejected for weekly events with \`invalid_slot\`, and weekly slots are rejected for date events.

## 2. Add availability for a name

Slots are 30-minute ids in event-timezone wall time: \`YYYY-MM-DDTHH:mm\` where minutes are \`00|30\` and inside the event range.

\`\`\`sh
curl -X PUT HOST/api/events/AbC123_-XyZ9/availability \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Alice",
    "password": "optional-secret-1234",
    "slots": ["2026-10-05T09:00", "2026-10-05T09:30"]
  }'
\`\`\`

POST works as an alias for PUT. This is a full replace, not a merge. Send the complete set. Empty \`slots: []\` means unavailable everywhere.

Passwords:
- Optional, 4..72 chars. Send in the request body on writes and in the \`x-event-password\` header on reads, only over HTTPS.
- Server stores only a PBKDF2-SHA-256 hash with random salt. It never returns hashes.
- Returning user must send the same \`name\` and \`password\`. Wrong password returns \`401 {"error":{"code":"invalid_password"}}\`.
- A name without a password can be claimed later by setting one on update.

## 3. Read group availability

\`\`\`sh
curl HOST/api/events/AbC123_-XyZ9
\`\`\`

Returns the event, the full 30-minute \`slotUniverse\`, per-slot \`counts\` with names, \`participants\` (names only, no hashes), and \`bestTimes\` sorted by count then earliest, and \`polls\` with public vote counts and voter names.

Fetch one person's slots for editing:

\`\`\`sh
curl 'HOST/api/events/AbC123_-XyZ9/availability?name=Alice' -H 'x-event-password: optional-secret-1234'
\`\`\`

## 3b. Polls

Events hold up to 10 polls. Anyone with the link can add a poll or add an option. Options with votes cannot be removed.

See \`GET HOST/api/openapi.json\` operations \`createPoll\`, \`addPollOption\`, \`putPollVote\` for schemas. Voting reuses the availability name and password.

## 4. Machine spec

- OpenAPI 3.1 with JSON Schemas: \`GET HOST/api/openapi.json\`
- Use it with openapi-typescript / openapi-fetch for typed clients.
- Errors look like \`{"error":{"code":"bad_request","message":"..."}}\`. Codes: \`bad_request\`, \`not_found\`, \`availability_not_found\`, \`gone\`, \`invalid_password\`, \`invalid_slot\`, \`rate_limited\`. \`404\` with \`availability_not_found\` means the event exists but that name has no saved availability yet.
- Rate limits per IP: create 10/hour, availability and poll writes 30/min, reads 120/min. \`429\` includes \`Retry-After\`.

## 5. Human flow (for context)

Humans open the \`url\`, enter name plus optional password, paint availability green by click-drag, and read the group heatmap. Darkest green wins. Data auto-deletes after the event passes.
`;
