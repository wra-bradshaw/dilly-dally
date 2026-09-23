import { describe, expect, it } from "vitest";
import { HttpError } from "./client";
import { decideSignInError, saveErrorMessage } from "./event-messages";

describe("saveErrorMessage", () => {
	it("maps each save failure to its recovery message", () => {
		expect(
			saveErrorMessage(new HttpError(401, "invalid_password", "x")),
		).toBe("Wrong password for this name. Change reverted.");
		expect(saveErrorMessage(new HttpError(422, "invalid_slot", "x"))).toBe(
			"Some times are outside the event. Reload and retry.",
		);
		expect(saveErrorMessage(new HttpError(410, "gone", "x"))).toBe(
			"This event has expired. Reload the page.",
		);
		expect(saveErrorMessage(new HttpError(410, "other", "x"))).toBe(
			"This event has expired. Reload the page.",
		);
		expect(saveErrorMessage(new HttpError(400, "bad_request", "x"))).toBe(
			"Could not save. Check your input and retry.",
		);
		expect(saveErrorMessage(new HttpError(429, "rate_limited", "x"))).toBe(
			"Saving too fast. Change reverted; paint again.",
		);
		expect(saveErrorMessage(new HttpError(500, "error", "x"))).toBe(
			"Could not save. Change reverted.",
		);
		expect(saveErrorMessage(new TypeError("offline"))).toBe(
			"Could not save. Change reverted.",
		);
	});
});

describe("decideSignInError", () => {
	it("routes a new name to a fresh sign-in", () => {
		expect(
			decideSignInError(
				new HttpError(404, "availability_not_found", "x"),
				false,
			),
		).toEqual({ kind: "fresh" });
		expect(
			decideSignInError(new HttpError(404, "other", "x"), false),
		).toEqual({ kind: "fresh" });
	});

	it("reports a taken name and a gone event distinctly", () => {
		expect(
			decideSignInError(new HttpError(401, "invalid_password", "x"), false),
		).toEqual({
			kind: "message",
			text: "That name is taken with a different password.",
		});
		expect(decideSignInError(new HttpError(410, "gone", "x"), false)).toEqual(
			{
				kind: "message",
				text: "This event is gone. Check the link and try again.",
			},
		);
		expect(
			decideSignInError(new HttpError(404, "not_found", "x"), true),
		).toEqual({
			kind: "message",
			text: "This event is gone. Check the link and try again.",
		});
	});

	it("falls back to a retry message for unexpected failures", () => {
		expect(
			decideSignInError(new HttpError(500, "error", "x"), false),
		).toEqual({ kind: "message", text: "Could not sign in. Try again." });
		expect(decideSignInError(new TypeError("offline"), false)).toEqual({
			kind: "message",
			text: "Could not sign in. Try again.",
		});
	});
});
