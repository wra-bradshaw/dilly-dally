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
- Weekly slots look like \`MON-09:15\`. Paint them with the same availability call, for example \`"slots": ["MON-09:00", "WED-09:15"]\`.
- Date slots (\`2026-10-05T09:00\`) are rejected for weekly events with \`invalid_slot\`, and weekly slots are rejected for date events.

## 2. Add availability for a name

Slots are 15-minute ids in event-timezone wall time: \`YYYY-MM-DDTHH:mm\` where minutes are \`00|15|30|45\` and inside the event range.

\`\`\`sh
curl -X PUT HOST/api/events/AbC123_-XyZ9/availability \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Alice",
    "password": "optional-secret-1234",
    "slots": ["2026-10-05T09:00", "2026-10-05T09:15"]
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

Returns the event, the full 15-minute \`slotUniverse\`, per-slot \`counts\` with names, \`participants\` (names only, no hashes), and \`bestTimes\` sorted by count then earliest.

Fetch one person's slots for editing:

\`\`\`sh
curl 'HOST/api/events/AbC123_-XyZ9/availability?name=Alice' -H 'x-event-password: optional-secret-1234'
\`\`\`

## 4. Machine spec

- OpenAPI 3.1 with JSON Schemas: \`GET HOST/api/openapi.json\`
- Use it with openapi-typescript / openapi-fetch for typed clients.
- Errors look like \`{"error":{"code":"bad_request","message":"..."}}\`. Codes: \`bad_request\`, \`not_found\`, \`gone\`, \`invalid_password\`, \`invalid_slot\`, \`rate_limited\`.
- Rate limits per IP: create 10/hour, availability writes 30/min, reads 120/min. \`429\` includes \`Retry-After\`.

## 5. Human flow (for context)

Humans open the \`url\`, enter name plus optional password, paint availability green by click-drag, and read the group heatmap. Darkest green wins. Data auto-deletes after the event passes.
`;
