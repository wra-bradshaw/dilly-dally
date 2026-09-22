import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	it("merges class names", () => {
		expect(cn("px-2", "px-4")).toBe("px-4");
	});

	it("handles conditional classes", () => {
		expect(cn("text-sm", false && "hidden", "font-medium")).toBe(
			"text-sm font-medium",
		);
	});
});
