import { describe, expect, it } from "vitest";
import { inviteUrl } from "./invite-url";

describe("inviteUrl", () => {
	it("builds an absolute URL from origin and event id", () => {
		expect(inviteUrl("abc123", "https://dally.example")).toBe(
			"https://dally.example/e/abc123",
		);
	});

	it("strips trailing slashes from origin", () => {
		expect(inviteUrl("abc123", "https://dally.example///")).toBe(
			"https://dally.example/e/abc123",
		);
	});

	it("falls back to a relative path when origin is empty", () => {
		expect(inviteUrl("abc123", "")).toBe("/e/abc123");
	});
});
