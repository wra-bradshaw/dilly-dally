import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	allowNamespace,
	denyNamespace,
	stubRateLimiter,
} from "../routes/api/events/-rate-limit-test-stub";
import { createSessionResponse } from "../routes/api/events/$eventId/sessions";
import { insertEvent } from "./db";
import {
	toEventDetailSsrResult,
	toOwnSessionSsrResult,
} from "./event-ssr-result";
import {
	readEventDetailSsr,
	readInviteOriginSsr,
	readOwnSessionSsr,
} from "./event-ssr-server";
import { upsertAvailability } from "./server-availability";
import { createTestDb } from "./test-db";

vi.mock("#/lib/db-env", () => ({
	getDb: () => (globalThis as unknown as Record<string, unknown>).__testDb,
}));

const event = {
	createdAt: 1_700_000_000_000,
	dates: ["2026-10-05"],
	endTime: "10:00",
	expiresAt: 1_800_000_000_000,
	id: "AbC123_-XyZ9",
	mode: "dates" as const,
	startTime: "09:00",
	timezone: "UTC",
	title: "Standup",
	weekdays: [] as number[],
};

const detailBody = {
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
		title: "Standup",
		weekdays: [],
	},
	participants: [],
	polls: [],
	slotUniverse: [],
};

beforeAll(async () => {
	const { db } = await createTestDb();
	(globalThis as unknown as Record<string, unknown>).__testDb = db;
	await insertEvent(
		(globalThis as unknown as { __testDb: Parameters<typeof insertEvent>[0] })
			.__testDb,
		event,
	);
	stubRateLimiter(allowNamespace());
});

afterEach(() => {
	stubRateLimiter(allowNamespace());
});

describe("toEventDetailSsrResult", () => {
	it("passes detail through on success", () => {
		const res = toEventDetailSsrResult(
			new Response("{}", { status: 200 }),
			detailBody,
		);
		expect(res).toEqual({ detail: detailBody, ok: true });
	});

	it("maps error bodies with status and code", () => {
		const res = toEventDetailSsrResult(new Response("{}", { status: 404 }), {
			error: { code: "not_found", message: "Missing" },
		});
		expect(res).toEqual({
			code: "not_found",
			message: "Missing",
			ok: false,
			retryAfter: undefined,
			status: 404,
		});
	});

	it("reads retryAfter from throttled responses", () => {
		const res = toEventDetailSsrResult(
			new Response("{}", {
				headers: { "Retry-After": "7" },
				status: 429,
			}),
			{ error: { code: "rate_limited", message: "Too many requests" } },
		);
		expect(res).toEqual({
			code: "rate_limited",
			message: "Too many requests",
			ok: false,
			retryAfter: 7,
			status: 429,
		});
	});

	it("maps expired responses to gone", () => {
		const res = toEventDetailSsrResult(new Response("{}", { status: 410 }), {
			error: { code: "gone", message: "Event expired" },
		});
		expect(res).toEqual({
			code: "gone",
			message: "Event expired",
			ok: false,
			retryAfter: undefined,
			status: 410,
		});
	});
});

describe("toOwnSessionSsrResult", () => {
	it("passes name and slots through on success", () => {
		const res = toOwnSessionSsrResult(new Response("{}", { status: 200 }), {
			name: "Ada",
			slots: ["a"],
		});
		expect(res).toEqual({ name: "Ada", ok: true, slots: ["a"] });
	});

	it("maps error bodies to ok:false with code", () => {
		const res = toOwnSessionSsrResult(new Response("{}", { status: 404 }), {
			error: { code: "gone", message: "Expired" },
		});
		expect(res).toEqual({ code: "gone", ok: false });
	});
});

describe("readEventDetailSsr", () => {
	it("returns detail through the shared handler", async () => {
		const res = await readEventDetailSsr(
			event.id,
			new Request(`https://x.test/e/${event.id}`),
		);
		expect(res.ok).toBe(true);
		if (res.ok) expect(res.detail.event.title).toBe("Standup");
	});

	it("maps unknown ids to not_found", async () => {
		const res = await readEventDetailSsr(
			"QwErTyUiOp12",
			new Request("https://x.test/e/QwErTyUiOp12"),
		);
		expect(res).toMatchObject({ code: "not_found", ok: false, status: 404 });
	});

	it("maps expired events to gone", async () => {
		const db = (
			globalThis as unknown as {
				__testDb: Parameters<typeof insertEvent>[0];
			}
		).__testDb;
		const now = Date.now();
		await insertEvent(db, {
			...event,
			createdAt: now - 10_000,
			expiresAt: now - 1000,
			id: "EXPIRED_-012",
		});
		const res = await readEventDetailSsr(
			"EXPIRED_-012",
			new Request("https://x.test/e/EXPIRED_-012"),
		);
		expect(res).toMatchObject({ code: "gone", ok: false, status: 410 });
	});

	it("maps throttles with retryAfter", async () => {
		stubRateLimiter(denyNamespace());
		const res = await readEventDetailSsr(
			event.id,
			new Request(`https://x.test/e/${event.id}`),
		);
		expect(res).toMatchObject({ code: "rate_limited", ok: false, status: 429 });
		if (!res.ok) expect(typeof res.retryAfter).toBe("number");
	});
});

describe("readInviteOriginSsr", () => {
	it("returns the request origin", () => {
		expect(
			readInviteOriginSsr(new Request("https://dally.example/e/abc123")),
		).toBe("https://dally.example");
	});
});

describe("readOwnSessionSsr", () => {
	it("returns ok:false without a session cookie", async () => {
		const res = await readOwnSessionSsr(
			event.id,
			new Request(`https://x.test/e/${event.id}`),
		);
		expect(res).toEqual({ code: "not_found", ok: false });
	});

	it("returns name and slots for a valid session cookie", async () => {
		const db = (
			globalThis as unknown as {
				__testDb: Parameters<typeof upsertAvailability>[0];
			}
		).__testDb;
		await upsertAvailability(
			db,
			event,
			{ name: "Ada", slots: ["2026-10-05T09:00"] },
			1000,
		);
		const login = await createSessionResponse(
			event.id,
			new Request(`https://x.test/api/events/${event.id}/sessions`, {
				body: JSON.stringify({ name: "Ada" }),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);
		expect(login.status).toBe(201);
		const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
		const res = await readOwnSessionSsr(
			event.id,
			new Request(`https://x.test/e/${event.id}`, { headers: { cookie } }),
		);
		expect(res).toEqual({
			name: "Ada",
			ok: true,
			slots: ["2026-10-05T09:00"],
		});
	});

	it("maps throttles to ok:false", async () => {
		stubRateLimiter(denyNamespace());
		const res = await readOwnSessionSsr(
			event.id,
			new Request(`https://x.test/e/${event.id}`),
		);
		expect(res).toEqual({ code: "rate_limited", ok: false });
	});
});
