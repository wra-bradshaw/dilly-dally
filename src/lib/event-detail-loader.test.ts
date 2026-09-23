import { describe, expect, it } from "vitest";
import { readLimitContext } from "./event-detail-loader";

describe("readLimitContext", () => {
	it("passes allowed requests without a retry hint", () => {
		expect(readLimitContext(true, 60_000, 1000)).toEqual({ limited: false });
	});

	it("maps a denial to 429 context with a retry delay", () => {
		expect(readLimitContext(false, 61_000, 1000)).toEqual({
			limited: true,
			retryAfter: 60,
		});
	});

	it("floors the retry delay at one second", () => {
		expect(readLimitContext(false, 1000, 1000).retryAfter).toBe(1);
	});
});
