import { HttpError } from "./http-error";
import { MAX_OPTIONS_PER_POLL, MAX_POLLS_PER_EVENT } from "./validation";

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

export function pollVoteErrorMessage(err: unknown): string {
	if (err instanceof HttpError && err.code === "invalid_password")
		return "Wrong password for this name.";
	if (err instanceof HttpError && err.code === "rate_limited")
		return "Saving too fast — vote reverted.";
	if (err instanceof HttpError && err.code === "invalid_option")
		return "That selection is no longer valid. Reloading.";
	return "Could not save vote. Try again.";
}

export function pollOptionErrorMessage(
	err: unknown,
	action: "add" | "remove",
): string {
	const fallback =
		action === "add"
			? "Could not add option. Try again."
			: "Could not remove option. Try again.";
	if (err instanceof HttpError && err.code === "duplicate_option")
		return "This option already exists.";
	if (err instanceof HttpError && err.code === "has_votes")
		return "Cannot remove an option that already has votes.";
	if (err instanceof HttpError && err.code === "too_few_options")
		return "Polls need at least two options.";
	if (err instanceof HttpError && err.code === "too_many_options")
		return `This poll already has ${MAX_OPTIONS_PER_POLL} options.`;
	return fallback;
}

export function pollCreateErrorMessage(err: unknown): string {
	if (err instanceof HttpError && err.code === "duplicate_poll")
		return "A poll with this question already exists.";
	if (err instanceof HttpError && err.code === "too_many_polls")
		return `This event already has ${MAX_POLLS_PER_EVENT} polls.`;
	return "Could not create poll. Try again.";
}
