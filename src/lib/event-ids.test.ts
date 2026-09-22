import { describe, expect, it } from "vitest";
import { generateEventId, isValidEventId } from "./event-ids";

describe("generateEventId", () => {
	it("generates a 12-char url-safe id", () => {
		const id = generateEventId();
		expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
		expect(isValidEventId(id)).toBe(true);
	});

	it("generates unique ids", () => {
		const ids = new Set(Array.from({ length: 1000 }, generateEventId));
		expect(ids.size).toBe(1000);
	});

	it("rejects invalid ids", () => {
		expect(isValidEventId("short")).toBe(false);
		expect(isValidEventId("too-long-identifier-123")).toBe(false);
		expect(isValidEventId("has spaces!!")).toBe(false);
		expect(isValidEventId("")).toBe(false);
	});
});
