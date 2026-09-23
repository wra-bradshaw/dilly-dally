import { describe, expect, it } from "vitest";
import { HttpError } from "./http-error";
import { decideSignInError, saveErrorMessage } from "./event-messages";

describe("saveErrorMessage", () => {
	it("maps invalid_password to wrong-password recovery", () => {
		expect(saveErrorMessage(new HttpError(401, "invalid_password", "x"))).toBe(
			"Wrong password for this name. Change reverted.",
		);
	});

	it("maps invalid_slot to reload recovery", () => {
		expect(saveErrorMessage(new HttpError(422, "invalid_slot", "x"))).toBe(
			"Some times are outside the event. Reload and retry.",
		);
	});

	it("maps gone code to expired message", () => {
		expect(saveErrorMessage(new HttpError(410, "gone", "x"))).toBe(
			"This event has expired. Reload the page.",
		);
	});

	it("maps bare 410 status to expired message", () => {
		expect(saveErrorMessage(new HttpError(410, "other", "x"))).toBe(
			"This event has expired. Reload the page.",
		);
	});

	it("maps bad_request to input-check recovery", () => {
		expect(saveErrorMessage(new HttpError(400, "bad_request", "x"))).toBe(
			"Could not save. Check your input and retry.",
		);
	});

	it("maps rate_limited to repaint recovery", () => {
		expect(saveErrorMessage(new HttpError(429, "rate_limited", "x"))).toBe(
			"Saving too fast. Change reverted; paint again.",
		);
	});

	it("maps unknown server errors to generic fallback", () => {
		expect(saveErrorMessage(new HttpError(500, "error", "x"))).toBe(
			"Could not save. Change reverted.",
		);
	});

	it("maps offline failures to generic fallback", () => {
		expect(saveErrorMessage(new TypeError("offline"))).toBe(
			"Could not save. Change reverted.",
		);
	});
});

describe("decideSignInError", () => {
	it("routes a new name to a fresh sign-in", () => {
		expect(
			decideSignInError(new HttpError(404, "availability_not_found", "x")),
		).toEqual({ kind: "fresh" });
	});

	it("reports a taken name distinctly", () => {
		expect(
			decideSignInError(new HttpError(401, "invalid_password", "x")),
		).toEqual({
			kind: "message",
			text: "That name is taken with a different password.",
		});
	});

	it("reports a gone event distinctly", () => {
		expect(decideSignInError(new HttpError(410, "gone", "x"))).toEqual({
			kind: "message",
			text: "This event is gone. Check the link and try again.",
		});
	});

	it("reports a missing event as gone", () => {
		expect(decideSignInError(new HttpError(404, "not_found", "x"))).toEqual({
			kind: "message",
			text: "This event is gone. Check the link and try again.",
		});
	});

	it("falls back to retry for unexpected server failures", () => {
		expect(decideSignInError(new HttpError(500, "error", "x"))).toEqual({
			kind: "message",
			text: "Could not sign in. Try again.",
		});
	});

	it("falls back to retry for offline failures", () => {
		expect(decideSignInError(new TypeError("offline"))).toEqual({
			kind: "message",
			text: "Could not sign in. Try again.",
		});
	});
});
