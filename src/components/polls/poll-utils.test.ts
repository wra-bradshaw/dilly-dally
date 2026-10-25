import { describe, expect, it } from "vitest";
import { nameKey } from "#/lib/validation";
import { countUniqueVoters, ownIdsForName, voteShare } from "./poll-utils";

describe("voteShare", () => {
	it("returns 0 when there are no voters", () => {
		expect(voteShare(0, 0)).toBe(0);
		expect(voteShare(3, 0)).toBe(0);
	});

	it("rounds to whole percent", () => {
		expect(voteShare(1, 3)).toBe(33);
		expect(voteShare(2, 3)).toBe(67);
		expect(voteShare(1, 1)).toBe(100);
	});
});

describe("ownIdsForName", () => {
	it("matches names case-insensitively", () => {
		const options = [
			{ id: "a", names: ["Ada"] },
			{ id: "b", names: ["Bo"] },
		];
		expect(ownIdsForName(options, "ada", nameKey)).toEqual(new Set(["a"]));
		expect(ownIdsForName(options, "", nameKey)).toEqual(new Set());
	});
});

describe("countUniqueVoters", () => {
	it("dedupes voters across options case-insensitively", () => {
		const options = [{ names: ["Ada", "Bo"] }, { names: ["ada", "Cy"] }];
		expect(countUniqueVoters(options, nameKey)).toBe(3);
	});
});
