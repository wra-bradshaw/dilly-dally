import { describe, expect, it, vi } from "vitest";
import { withLiveEvent } from "./live-event-guard";

vi.mock("./db-env", () => ({
	getDb: () => ({ mocked: true }),
}));

vi.mock("./server-rate-limit", () => ({
	guardRateLimit: () => Promise.resolve(null),
}));

vi.mock("./server-event-detail", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./server-event-detail")>();
	return {
		...actual,
		loadLiveEvent: () =>
			Promise.resolve({
				event: { id: "AbC123_-XyZ9", title: "T" },
				ok: true as const,
			}),
	};
});

describe("withLiveEvent", () => {
	it("returns db and event for same-origin requests", async () => {
		const req = new Request("https://x.test/api/events/AbC123_-XyZ9/polls", {
			method: "POST",
		});
		const ctx = await withLiveEvent(req, "AbC123_-XyZ9", "availability_write", {
			limit: 30,
			windowMs: 60_000,
		});
		expect("event" in ctx && ctx.event.id).toBe("AbC123_-XyZ9");
	});

	it("rejects cross-origin writes", async () => {
		const req = new Request("https://x.test/api/events/AbC123_-XyZ9/polls", {
			headers: { origin: "https://evil.test" },
			method: "POST",
		});
		const ctx = await withLiveEvent(req, "AbC123_-XyZ9", "availability_write", {
			limit: 30,
			windowMs: 60_000,
		});
		expect("response" in ctx && ctx.response.status).toBe(403);
	});
});
