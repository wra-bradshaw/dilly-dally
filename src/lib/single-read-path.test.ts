import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

describe("single read path", () => {
	it("has no event-detail-loader duplicate", () => {
		let loaderExists = true;
		try {
			readFileSync(new URL("./event-detail-loader.ts", import.meta.url));
		} catch {
			loaderExists = false;
		}
		expect(loaderExists).toBe(false);
		for (const file of [
			"../routes/e/$eventId.tsx",
			"../hooks/use-own-session.ts",
		]) {
			const src = readFileSync(new URL(file, import.meta.url), "utf-8");
			expect(src).not.toContain("event-detail-loader");
			expect(src).not.toContain("fetchEventDetailServerFn");
			expect(src).not.toContain("fetchOwnSessionServerFn");
		}
	});

	it("event detail uses typed client against GET /api/events/:id", async () => {
		const { fetchEventDetail } = await import("./client");
		const body = {
			bestTimes: [],
			counts: [],
			event: {
				createdAt: "2026-09-22T00:00:00.000Z",
				dates: ["2026-10-05"],
				endTime: "10:00",
				expiresAt: "2026-10-06T00:00:00.000Z",
				id: "AbC123_-XyZ9",
				mode: "dates",
				startTime: "09:00",
				timezone: "UTC",
				title: "T",
				weekdays: [],
			},
			participants: [],
			polls: [],
			slotUniverse: [],
		};
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(body), {
				headers: { "Content-Type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			const detail = await fetchEventDetail("AbC123_-XyZ9");
			expect(detail.event.title).toBe("T");
			const req = fetchMock.mock.calls[0]?.[0] as Request;
			expect(req.url).toContain("/api/events/AbC123_-XyZ9");
			expect(req.method).toBe("GET");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("maps rate-limited detail errors with retryAfter", async () => {
		const { fetchEventDetail } = await import("./client");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: { code: "rate_limited", message: "Too many requests" },
					}),
					{
						headers: {
							"Content-Type": "application/json",
							"Retry-After": "7",
						},
						status: 429,
					},
				),
			),
		);
		try {
			const err = await fetchEventDetail("AbC123_-XyZ9").catch((e) => e);
			expect(err.status).toBe(429);
			expect(err.code).toBe("rate_limited");
			expect(err.retryAfter).toBe(7);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("own session uses typed client against GET /api/events/:id/sessions", async () => {
		const { fetchOwnSession } = await import("./client");
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ name: "Ada", slots: ["a"] }), {
				headers: { "Content-Type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			const own = await fetchOwnSession("AbC123_-XyZ9");
			expect(own).toEqual({ name: "Ada", slots: ["a"] });
			const req = fetchMock.mock.calls[0]?.[0] as Request;
			expect(req.url).toContain("/api/events/AbC123_-XyZ9/sessions");
			expect(req.method).toBe("GET");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("own session maps HttpError to ok:false with code", async () => {
		const { fetchOwnSession } = await import("./client");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: { code: "gone", message: "Expired" },
					}),
					{
						headers: { "Content-Type": "application/json" },
						status: 410,
					},
				),
			),
		);
		try {
			const err = await fetchOwnSession("AbC123_-XyZ9").catch((e) => e);
			expect(err.status).toBe(410);
			expect(err.code).toBe("gone");
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
