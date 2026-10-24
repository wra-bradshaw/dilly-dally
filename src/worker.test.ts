import handler from "@tanstack/react-start/server-entry";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AGENT_GUIDE_MARKDOWN } from "./lib/agent-guide";
import { purgeExpired } from "./lib/db";
import { HttpError } from "./lib/http-error";
import worker, {
	markdownRoute,
	maybeServeMarkdown,
	needsDocumentHeaders,
	withDocumentHeaders,
} from "./worker";

vi.mock("./lib/db", () => ({ purgeExpired: vi.fn() }));
vi.mock("./lib/db-env", () => ({ getDb: vi.fn(() => ({ mocked: true })) }));
vi.mock("./lib/server-event-detail", () => ({
	loadEventDetailFromDb: vi.fn(),
}));
vi.mock("./lib/server-rate-limit", () => ({ guardRateLimit: vi.fn() }));
vi.mock("drizzle-orm/d1", () => ({
	drizzle: vi.fn(() => ({ mocked: true }) as never),
}));
vi.mock("@tanstack/react-start/server-entry", () => ({
	default: { fetch: vi.fn() },
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe("needsDocumentHeaders", () => {
	it("matches HTML regardless of content-type case", () => {
		expect(needsDocumentHeaders("text/html; charset=utf-8")).toBe(true);
		expect(needsDocumentHeaders("Text/HTML; charset=utf-8")).toBe(true);
		expect(needsDocumentHeaders("TEXT/HTML")).toBe(true);
	});

	it("leaves JSON and missing content types untouched", () => {
		expect(needsDocumentHeaders("application/json")).toBe(false);
		expect(needsDocumentHeaders(null)).toBe(false);
		expect(needsDocumentHeaders("")).toBe(false);
	});
});

describe("withDocumentHeaders", () => {
	it("sets DENY, nosniff, and referrer on HTML", () => {
		const res = withDocumentHeaders(
			new Response("<html></html>", {
				headers: { "content-type": "text/html" },
			}),
		);
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
	});

	it("returns JSON responses untouched", () => {
		const res = new Response("{}", {
			headers: { "content-type": "application/json" },
		});
		expect(withDocumentHeaders(res)).toBe(res);
	});

	it("adds Vary for content negotiation to HTML", () => {
		const res = withDocumentHeaders(
			new Response("<html></html>", {
				headers: { "content-type": "text/html" },
			}),
		);
		expect(res.headers.get("Vary")).toBe("Accept, User-Agent, Cookie");
	});

	it("merges Vary with existing values instead of replacing them", () => {
		const res = withDocumentHeaders(
			new Response("<html></html>", {
				headers: { "content-type": "text/html", vary: "Cookie" },
			}),
		);
		expect(res.headers.get("Vary")).toBe("Cookie, Accept, User-Agent");
	});

	it("preserves status, statusText, and body through the re-wrap", async () => {
		const res = withDocumentHeaders(
			new Response("<html></html>", {
				headers: { "content-type": "Text/HTML" },
				status: 404,
				statusText: "Not Found",
			}),
		);
		expect(res.status).toBe(404);
		expect(res.statusText).toBe("Not Found");
		expect(await res.text()).toBe("<html></html>");
	});
});

describe("markdownRoute", () => {
	it("matches the home page", () => {
		expect(markdownRoute(new URL("https://x.test/"))).toEqual({
			kind: "home",
		});
	});

	it("matches event pages with or without a trailing slash", () => {
		expect(markdownRoute(new URL("https://x.test/e/AbC123"))).toEqual({
			eventId: "AbC123",
			kind: "event",
		});
		expect(markdownRoute(new URL("https://x.test/e/AbC123/"))).toEqual({
			eventId: "AbC123",
			kind: "event",
		});
	});

	it("ignores API routes, assets, and nested paths", () => {
		expect(markdownRoute(new URL("https://x.test/api/events"))).toBeNull();
		expect(markdownRoute(new URL("https://x.test/llms.txt"))).toBeNull();
		expect(markdownRoute(new URL("https://x.test/e/AbC123/extra"))).toBeNull();
		expect(markdownRoute(new URL("https://x.test/e/"))).toBeNull();
	});
});

const CURL_HEADERS = { "user-agent": "curl/8.4.0" };
const BROWSER_HEADERS = {
	accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"user-agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
};

function eventDetailFixture() {
	return {
		bestTimes: [{ count: 1, slot: "2026-10-05T09:00" }],
		counts: [{ count: 1, names: ["Ada"], slot: "2026-10-05T09:00" }],
		event: {
			endTime: "17:00",
			expiresAt: "2027-01-01T00:00:00.000Z",
			id: "AbC123",
			mode: "dates",
			startTime: "09:00",
			timezone: "America/New_York",
			title: "Team offsite",
			weekdays: [],
		},
		participants: [
			{ count: 1, name: "Ada", updatedAt: "2026-10-01T00:00:00.000Z" },
		],
		polls: [],
		slotUniverse: ["2026-10-05T09:00"],
	};
}

describe("maybeServeMarkdown", () => {
	it("serves the agent guide to agents on the home page", async () => {
		const res = await maybeServeMarkdown(
			new Request("https://x.test/", { headers: CURL_HEADERS }),
		);
		expect(res?.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(res?.headers.get("Cache-Control")).toBe("no-store");
		expect(res?.headers.get("Vary")).toBe("Accept, User-Agent");
		expect(res?.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(await res?.text()).toContain(AGENT_GUIDE_MARKDOWN.slice(0, 40));
	});

	it("returns null for browsers on the home page", async () => {
		const res = await maybeServeMarkdown(
			new Request("https://x.test/", { headers: BROWSER_HEADERS }),
		);
		expect(res).toBeNull();
	});

	it("returns null for API routes even for agents", async () => {
		const res = await maybeServeMarkdown(
			new Request("https://x.test/api/events", { headers: CURL_HEADERS }),
		);
		expect(res).toBeNull();
	});

	it("serves event detail markdown to agents", async () => {
		const { guardRateLimit } = await import("./lib/server-rate-limit");
		const { loadEventDetailFromDb } = await import("./lib/server-event-detail");
		vi.mocked(guardRateLimit).mockResolvedValue(null);
		vi.mocked(loadEventDetailFromDb).mockResolvedValue(
			eventDetailFixture() as never,
		);
		const res = await maybeServeMarkdown(
			new Request("https://x.test/e/AbC123", { headers: CURL_HEADERS }),
		);
		expect(res?.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(res?.headers.get("Cache-Control")).toBe("no-store");
		expect(res?.headers.get("Vary")).toBe("Accept, User-Agent");
		const body = await res?.text();
		expect(body).toContain("# Team offsite");
		expect(body).toContain("https://x.test/e/AbC123");
	});

	it("serves event detail markdown with a trailing slash", async () => {
		const { guardRateLimit } = await import("./lib/server-rate-limit");
		const { loadEventDetailFromDb } = await import("./lib/server-event-detail");
		vi.mocked(guardRateLimit).mockResolvedValue(null);
		vi.mocked(loadEventDetailFromDb).mockResolvedValue(
			eventDetailFixture() as never,
		);
		const res = await maybeServeMarkdown(
			new Request("https://x.test/e/AbC123/", { headers: CURL_HEADERS }),
		);
		expect(res?.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(await res?.text()).toContain("# Team offsite");
	});

	it("serves a markdown 404 for missing events", async () => {
		const { guardRateLimit } = await import("./lib/server-rate-limit");
		const { loadEventDetailFromDb } = await import("./lib/server-event-detail");
		vi.mocked(guardRateLimit).mockResolvedValue(null);
		vi.mocked(loadEventDetailFromDb).mockRejectedValue(
			new HttpError(404, "not_found", "Event not found"),
		);
		const res = await maybeServeMarkdown(
			new Request("https://x.test/e/nope", { headers: CURL_HEADERS }),
		);
		expect(res?.status).toBe(404);
		expect(res?.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(res?.headers.get("Cache-Control")).toBe("no-store");
		expect(res?.headers.get("Vary")).toBe("Accept, User-Agent");
		expect(res?.headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
		expect(await res?.text()).toContain("Event not found");
	});

	it("serves a markdown 410 for expired events", async () => {
		const { guardRateLimit } = await import("./lib/server-rate-limit");
		const { loadEventDetailFromDb } = await import("./lib/server-event-detail");
		vi.mocked(guardRateLimit).mockResolvedValue(null);
		vi.mocked(loadEventDetailFromDb).mockRejectedValue(
			new HttpError(410, "gone", "Event has expired"),
		);
		const res = await maybeServeMarkdown(
			new Request("https://x.test/e/old", { headers: CURL_HEADERS }),
		);
		expect(res?.status).toBe(410);
		expect(res?.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(res?.headers.get("Cache-Control")).toBe("no-store");
		expect(res?.headers.get("Vary")).toBe("Accept, User-Agent");
		const body = await res?.text();
		expect(body).toContain("Event expired");
		expect(body).toContain("deleted after they pass");
	});

	it("serves a markdown 500 when detail loading fails", async () => {
		const { guardRateLimit } = await import("./lib/server-rate-limit");
		const { loadEventDetailFromDb } = await import("./lib/server-event-detail");
		vi.mocked(guardRateLimit).mockResolvedValue(null);
		vi.mocked(loadEventDetailFromDb).mockRejectedValue(
			new TypeError("D1 is down"),
		);
		const res = await maybeServeMarkdown(
			new Request("https://x.test/e/AbC123", { headers: CURL_HEADERS }),
		);
		expect(res?.status).toBe(500);
		expect(res?.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(await res?.text()).toContain("Something went wrong");
	});

	it("adds Vary to the rate-limit response when limited", async () => {
		const { guardRateLimit } = await import("./lib/server-rate-limit");
		const limited = new Response("{}", {
			headers: { "content-type": "application/json", vary: "Cookie" },
			status: 429,
			statusText: "Too Many Requests",
		});
		vi.mocked(guardRateLimit).mockResolvedValue(limited);
		const res = await maybeServeMarkdown(
			new Request("https://x.test/e/AbC123", { headers: CURL_HEADERS }),
		);
		expect(res?.status).toBe(429);
		expect(res?.statusText).toBe("Too Many Requests");
		expect(res?.headers.get("Content-Type")).toBe("application/json");
		expect(res?.headers.get("Vary")).toBe("Cookie, Accept, User-Agent");
		expect(await res?.text()).toBe("{}");
	});
});

describe("worker fetch", () => {
	it("passes the request through and adds document headers to HTML", async () => {
		vi.mocked(handler.fetch).mockResolvedValue(
			new Response("<html></html>", {
				headers: { "content-type": "text/html" },
			}),
		);
		const request = new Request("https://x.test/");
		const res = await worker.fetch(request);
		expect(handler.fetch).toHaveBeenCalledTimes(1);
		expect(handler.fetch).toHaveBeenCalledWith(request);
		expect(res.headers.get("X-Frame-Options")).toBe("DENY");
		expect(await res.text()).toBe("<html></html>");
	});

	it("leaves JSON from the server handler untouched", async () => {
		const inner = new Response("{}", {
			headers: { "content-type": "application/json" },
		});
		vi.mocked(handler.fetch).mockResolvedValue(inner);
		const res = await worker.fetch(new Request("https://x.test/api/events"));
		expect(res).toBe(inner);
	});

	it("serves markdown to agents without hitting the SSR handler", async () => {
		const res = await worker.fetch(
			new Request("https://x.test/", { headers: CURL_HEADERS }),
		);
		expect(handler.fetch).not.toHaveBeenCalled();
		expect(res.headers.get("Content-Type")).toBe(
			"text/markdown; charset=utf-8",
		);
		expect(await res.text()).toContain(AGENT_GUIDE_MARKDOWN.slice(0, 40));
	});
});

describe("worker scheduled", () => {
	it("purges expired events with the D1 database", async () => {
		const env = { DB: { scheduled: true } } as unknown as Env;
		await worker.scheduled(
			{} as ScheduledController,
			env,
			{} as ExecutionContext,
		);
		expect(drizzle).toHaveBeenCalledTimes(1);
		expect(purgeExpired).toHaveBeenCalledTimes(1);
		expect(vi.mocked(purgeExpired).mock.calls[0]?.[0]).toEqual({
			mocked: true,
		});
		expect(typeof vi.mocked(purgeExpired).mock.calls[0]?.[1]).toBe("number");
	});
});
