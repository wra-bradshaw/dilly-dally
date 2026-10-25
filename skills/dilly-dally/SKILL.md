---
name: dilly-dally
description: Use when finding a time for an event with other people. Use when checking availability, when2meet, or dally.bradshaw.page is mentioned.
---

# Dilly Dally

Agent-friendly group scheduling. Send a link to friends, they add their availability, then you decide on a date.

You can add polls (where to eat), check availability, update availability, create events.

Base URL: `https://dally.bradshaw.page`

Fetch live docs first — do not rely on memory:

- Full guide: `GET https://dally.bradshaw.page/ with Accept: text/markdown`
- Machine spec: `GET https://dally.bradshaw.page/api/openapi.json`
- Live event: `GET https://dally.bradshaw.page/e/:id with Accept: text/markdown`

Flows (see live guide for schemas):

- Create event: `POST /api/events`
- Submit availability: `PUT /api/events/:id/availability`
- Read results: `GET /api/events/:id`
- Polls: `POST /api/events/:id/polls`, `POST /api/events/:id/polls/:pollId/options`, `PUT /api/events/:id/polls/:pollId/vote`

Share the `/e/:id` URL with users.
