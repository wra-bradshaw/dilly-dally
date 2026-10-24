import { describe, expect, it } from "vitest";
import {
	pollCreateErrorMessage,
	pollOptionErrorMessage,
	pollVoteErrorMessage,
} from "./event-messages";
import { HttpError } from "./http-error";

function err(code: string): HttpError {
	return new HttpError(400, code, code);
}

describe("pollVoteErrorMessage", () => {
	it("maps vote failures", () => {
		expect(pollVoteErrorMessage(err("invalid_password"))).toBe(
			"Wrong password for this name.",
		);
		expect(pollVoteErrorMessage(err("rate_limited"))).toBe(
			"Saving too fast — vote reverted.",
		);
		expect(pollVoteErrorMessage(err("invalid_option"))).toBe(
			"That selection is no longer valid. Reloading.",
		);
		expect(pollVoteErrorMessage(err("nope"))).toBe(
			"Could not save vote. Try again.",
		);
	});
});

describe("pollOptionErrorMessage", () => {
	it("maps option failures", () => {
		expect(pollOptionErrorMessage(err("duplicate_option"), "add")).toBe(
			"This option already exists.",
		);
		expect(pollOptionErrorMessage(err("has_votes"), "remove")).toBe(
			"Cannot remove an option that already has votes.",
		);
		expect(pollOptionErrorMessage(err("too_few_options"), "remove")).toBe(
			"Polls need at least two options.",
		);
	});

	it("keeps add and remove fallbacks distinct", () => {
		expect(pollOptionErrorMessage(err("nope"), "add")).toBe(
			"Could not add option. Try again.",
		);
		expect(pollOptionErrorMessage(err("nope"), "remove")).toBe(
			"Could not remove option. Try again.",
		);
	});
});

describe("pollCreateErrorMessage", () => {
	it("maps create failures", () => {
		expect(pollCreateErrorMessage(err("duplicate_poll"))).toBe(
			"A poll with this question already exists.",
		);
		expect(
			pollCreateErrorMessage(new HttpError(429, "rate_limited", "slow")),
		).toBe("Could not create poll. Try again.");
	});
});
