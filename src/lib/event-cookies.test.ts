import { describe, expect, it } from "vitest";
import {
	buildSessionCookie,
	clearSessionCookie,
	parseSessionCookie,
	sessionCookieName,
} from "./event-cookies";

describe("event cookies", () => {
	it("builds a parseable HttpOnly session cookie", () => {
		const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ1234567890-_";
		const header = buildSessionCookie("AbC123_-XyZ9", token, false);
		expect(header).toContain(`${sessionCookieName("AbC123_-XyZ9")}=${token}`);
		expect(header).toContain("HttpOnly");
		expect(header).toContain("SameSite=Lax");
		expect(header).toContain("Path=/");
		expect(
			parseSessionCookie(
				`other=1; ${sessionCookieName("AbC123_-XyZ9")}=${token}`,
				"AbC123_-XyZ9",
			),
		).toBe(token);
	});

	it("uses Secure in production", () => {
		const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ1234567890-_";
		expect(buildSessionCookie("AbC123_-XyZ9", token, true)).toContain("Secure");
	});

	it("clears with an expired cookie", () => {
		const header = clearSessionCookie("AbC123_-XyZ9", false);
		expect(header).toContain("Max-Age=0");
		expect(parseSessionCookie(header, "AbC123_-XyZ9")).toBeNull();
	});

	it("rejects invalid event ids", () => {
		expect(sessionCookieName("bad/id")).toBeNull();
		expect(parseSessionCookie("x=1", "bad/id")).toBeNull();
	});
});
