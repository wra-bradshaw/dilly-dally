import { describe, expect, it } from "vitest";
import { liveEventDenial, retryAfterSeconds } from "./denials";

describe("retryAfterSeconds", () => {
	it("rounds up to whole seconds", () => {
		expect(retryAfterSeconds(61_000, 1000)).toBe(60);
		expect(retryAfterSeconds(1500, 1000)).toBe(1);
	});

	it("floors the delay at one second", () => {
		expect(retryAfterSeconds(1000, 1000)).toBe(1);
		expect(retryAfterSeconds(500, 1000)).toBe(1);
	});
});

describe("liveEventDenial", () => {
	it("maps gone to 410 with the expiry message", () => {
		expect(liveEventDenial("gone")).toEqual({
			code: "gone",
			message: "Event has expired",
			status: 410,
		});
	});

	it("maps not_found to 404 with the missing message", () => {
		expect(liveEventDenial("not_found")).toEqual({
			code: "not_found",
			message: "Event not found",
			status: 404,
		});
	});
});
