import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
	it("hashes and verifies a password", async () => {
		const hash = await hashPassword("correct-horse-123");
		expect(hash).toContain("$");
		expect(await verifyPassword("correct-horse-123", hash)).toBe(true);
	}, 15000);

	it("rejects wrong password", async () => {
		const hash = await hashPassword("s3cret-pass");
		expect(await verifyPassword("wrong-pass", hash)).toBe(false);
	}, 15000);

	it("produces different hashes for same password", async () => {
		const a = await hashPassword("same-password");
		const b = await hashPassword("same-password");
		expect(a).not.toBe(b);
	}, 15000);

	it("rejects malformed stored hash", async () => {
		expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
	});
});
