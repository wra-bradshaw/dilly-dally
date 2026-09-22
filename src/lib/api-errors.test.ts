import { describe, expect, it } from "vitest";
import { clientIp, jsonError, rateLimited, zodFields } from "./api-errors";
import type { ApiError } from "./api-types";
import { createEventSchema } from "./validation";

describe("jsonError", () => {
	it("returns the agent error shape", async () => {
		const res = await jsonError(
			"gone",
			"Event has expired",
			410,
		).json<ApiError>();
		expect(res).toEqual({
			error: { code: "gone", message: "Event has expired" },
		});
	});
});

describe("rateLimited", () => {
	it("sets 429 with Retry-After", () => {
		const res = rateLimited(Date.now() + 61_000);
		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBeTruthy();
	});
});

describe("zodFields", () => {
	it("maps issues by path", () => {
		const parsed = createEventSchema.safeParse({
			dates: [],
			endTime: "09:00",
			startTime: "09:00",
			timezone: "UTC",
			title: "",
		});
		expect(parsed.success).toBe(false);
		if (!parsed.success) {
			const fields = zodFields(parsed.error);
			expect(Object.keys(fields).length).toBeGreaterThan(0);
		}
	});
});

describe("clientIp", () => {
	it("prefers cf-connecting-ip", () => {
		const req = new Request("https://x.test/", {
			headers: { "cf-connecting-ip": "9.9.9.9" },
		});
		expect(clientIp(req)).toBe("9.9.9.9");
	});

	it("falls back to unknown", () => {
		expect(clientIp(new Request("https://x.test/"))).toBe("unknown");
	});
});
