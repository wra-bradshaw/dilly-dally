import { describe, expect, it } from "vitest";
import { rateLimitKey } from "./rate-limit";

describe("rateLimitKey", () => {
	it("hashes ip and scope without leaking ip", async () => {
		const key = await rateLimitKey("1.2.3.4", "create_event");
		expect(key).toContain("create_event:");
		expect(key).not.toContain("1.2.3.4");
	});
});

describe("windowStartFor", () => {
	it("computes window start", async () => {
		const { windowStartFor } = await import("./rate-limit");
		expect(windowStartFor(61_000, 60_000)).toBe(60_000);
		expect(windowStartFor(59_999, 60_000)).toBe(0);
	});
});
