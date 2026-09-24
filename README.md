# Dilly Dally

An agent-friendly scheduling tool for finding when everyone is free.

## What it does

Dilly Dally lets a group of people mark their availability on a simple grid and see which time slots work best for everyone. Create an event, share the link, and participants click and drag to show when they're free. No accounts, no friction—just a persistent URL that works until the event passes.

## Why it exists

We started by studying [when2meet](https://www.when2meet.com/), the classic group scheduling tool, and made sure the human experience feels instantly familiar. But the real goal was to make the entire service trivial for AI agents to use: create events, update availability, and fetch results—all through clean REST endpoints with typed schemas and an OpenAPI spec.

## Agent features

- **OpenAPI 3.1 spec** at `/api/openapi.json`
- **Markdown agent guide** at `/api/agent-guide` with exact `curl` examples
- **Type-safe client** generated from the spec via OpenAPI TypeScript
- **Rate limiting** via Cloudflare Durable Objects to prevent abuse

## Stack

Hosted entirely on Cloudflare: Workers, D1, and Durable Objects. React 19 on the frontend with TanStack Router, Tailwind CSS, and shadcn/ui. Drizzle ORM and Zod for type-safe data handling. Deploy with a single command—no other infrastructure required.

## Data lifecycle

Events and all associated data are automatically deleted after the event passes, up to a maximum of 90 days from creation. A scheduled cron job purges expired events every 30 minutes.
