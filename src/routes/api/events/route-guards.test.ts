import { env } from "cloudflare:workers";
import { afterEach, describe, expect, it } from "vitest";
import {
	getOwnAvailabilityResponse,
	saveAvailability,
} from "./$eventId/availability";
import { handleGetDetail } from "./$eventId/index";
import { handleCreate } from "./index";

function allowNamespace() {
	return {
		getByName: (_key: string) => ({
			check: async () => ({
				allowed: true,
				remaining: 1,
				resetMs: Date.now() + 1000,
			}),
		}),
	};
}

function denyNamespace() {
	return {
		getByName: (_key: string) => ({
			check: async () => ({
				allowed: false,
				remaining: 0,
				resetMs: Date.now() + 1000,
			}),
		}),
	};
}

function stubRateLimiter(namespace: unknown) {
	(env as unknown as Record<string, unknown>).RATE_LIMITER = namespace;
}

afterEach(() => {
	delete (env as unknown as Record<string, unknown>).RATE_LIMITER;
});

function postRequest(body: unknown, contentType = "application/json") {
	return new Request("https://x.test/api/events", {
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: { "content-type": contentType },
		method: "POST",
	});
}

describe("create guards", () => {
	it("checks the rate limit before parsing or validating", async () => {
		stubRateLimiter(denyNamespace());
		const res = await handleCreate(postRequest({ title: "x" }, "text/plain"));
		expect(res.status).toBe(429);
	});

	it("rejects oversized content-length with 413", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleCreate(
			new Request("https://x.test/api/events", {
				body: "{}",
				headers: {
					"content-length": String(300_000),
					"content-type": "application/json",
				},
				method: "POST",
			}),
		);
		expect(res.status).toBe(413);
	});

	it("rejects non-JSON content with 415", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleCreate(postRequest("{}", "text/plain"));
		expect(res.status).toBe(415);
	});

	it("caps chunked bodies without content-length at 256KB", async () => {
		stubRateLimiter(allowNamespace());
		const big = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('{"title":"'));
				controller.enqueue(new Uint8Array(300_000));
				controller.close();
			},
		});
		const res = await handleCreate(
			new Request("https://x.test/api/events", {
				body: big,
				duplex: "half",
				headers: { "content-type": "application/json" },
				method: "POST",
			} as RequestInit),
		);
		expect(res.status).toBe(413);
	});
});

describe("availability write guards", () => {
	const eventId = "AbC123_-XyZ9";

	it("checks the rate limit before parsing or validating", async () => {
		stubRateLimiter(denyNamespace());
		const res = await saveAvailability(
			postRequest({ name: "Ada" }, "text/plain"),
			eventId,
		);
		expect(res.status).toBe(429);
	});

	it("rejects oversized content-length with 413", async () => {
		stubRateLimiter(allowNamespace());
		const res = await saveAvailability(
			new Request("https://x.test/api/events/x/availability", {
				body: "{}",
				headers: {
					"content-length": String(300_000),
					"content-type": "application/json",
				},
				method: "PUT",
			}),
			eventId,
		);
		expect(res.status).toBe(413);
	});

	it("rejects non-JSON content with 415", async () => {
		stubRateLimiter(allowNamespace());
		const res = await saveAvailability(
			postRequest("{}", "text/plain"),
			eventId,
		);
		expect(res.status).toBe(415);
	});
});

describe("detail GET errors", () => {
	it("returns no-store on terminal error responses", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});

	it("serves error JSON without leaking stack traces", async () => {
		stubRateLimiter(allowNamespace());
		const res = await handleGetDetail(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/!!!not-an-id!!!"),
		);
		const body = (await res.json()) as {
			error: { code: string; message: string };
		};
		expect(body.error.code).toBe("not_found");
		expect(JSON.stringify(body)).not.toContain("at ");
	});

	it("marks own-availability errors no-store", async () => {
		stubRateLimiter(allowNamespace());
		const res = await getOwnAvailabilityResponse(
			"!!!not-an-id!!!",
			new Request("https://x.test/api/events/x/availability?name=Ada"),
		);
		expect(res.status).toBe(404);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
	});
});
