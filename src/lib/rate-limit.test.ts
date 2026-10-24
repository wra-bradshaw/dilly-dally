import { describe, expect, it } from "vitest";
import { rateLimitKey } from "./rate-limit";

describe("rateLimitKey", () => {
	it("hashes ip and scope without leaking ip", async () => {
		const key = await rateLimitKey("1.2.3.4", "create_event");
		expect(key).toContain("create_event:");
		expect(key).not.toContain("1.2.3.4");
	});
});
