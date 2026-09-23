import { HttpError } from "./client";

export function saveErrorMessage(err: unknown): string {
	if (err instanceof HttpError && err.code === "invalid_password") {
		return "Wrong password for this name. Change reverted.";
	}
	if (err instanceof HttpError && err.code === "invalid_slot") {
		return "Some times are outside the event. Reload and retry.";
	}
	if (err instanceof HttpError && (err.code === "gone" || err.status === 410)) {
		return "This event has expired. Reload the page.";
	}
	if (err instanceof HttpError && err.code === "bad_request") {
		return "Could not save. Check your input and retry.";
	}
	if (err instanceof HttpError && err.code === "rate_limited") {
		return "Saving too fast. Change reverted; paint again.";
	}
	return "Could not save. Change reverted.";
}

export type SignInDecision =
	| { kind: "fresh" }
	| { kind: "message"; text: string };

export function decideSignInError(err: unknown): SignInDecision {
	if (err instanceof HttpError && err.code === "invalid_password") {
		return {
			kind: "message",
			text: "That name is taken with a different password.",
		};
	}
	if (err instanceof HttpError && err.code === "availability_not_found") {
		return { kind: "fresh" };
	}
	if (
		err instanceof HttpError &&
		(err.code === "gone" ||
			err.status === 404 ||
			err.status === 403 ||
			err.status === 410)
	) {
		return {
			kind: "message",
			text: "This event is gone. Check the link and try again.",
		};
	}
	return { kind: "message", text: "Could not sign in. Try again." };
}
