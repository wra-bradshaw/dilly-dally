import { describe, expect, it } from "vitest";
import { HttpError } from "#/lib/http-error";
import { routeTitle } from "./__root";

describe("routeTitle", () => {
	it("titles the home route", () => {
		expect(routeTitle("/", undefined, null)).toBe("Plan a new event");
	});

	it("uses the event title once loaded", () => {
		expect(routeTitle("/e/abc", "Team offsite", null)).toBe("Team offsite");
	});

	it("maps event load failures to error titles", () => {
		expect(routeTitle("/e/abc", undefined, null)).toBe("Event details");
		expect(
			routeTitle("/e/abc", undefined, new HttpError(404, "not_found", "no")),
		).toBe("Event not found");
		expect(
			routeTitle("/e/abc", undefined, new HttpError(410, "gone", "old")),
		).toBe("Event expired");
		expect(
			routeTitle("/e/abc", undefined, new HttpError(429, "limited", "slow")),
		).toBe("Too many requests");
		expect(routeTitle("/e/abc", undefined, new TypeError("offline"))).toBe(
			"Could not load event",
		);
	});

	it("titles unknown paths as not found", () => {
		expect(routeTitle("/nope", undefined, null)).toBe("Page not found");
	});
});
