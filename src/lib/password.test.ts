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

	it("rejects tampered hash", async () => {
		const hash = await hashPassword("tamper-me-123");
		const parts = hash.split("$");
		const last = parts[3];
		const flipped = `${last.startsWith("A") ? "B" : "A"}${last.slice(1)}`;
		const tampered = [...parts.slice(0, 3), flipped].join("$");
		expect(tampered).not.toBe(hash);
		expect(await verifyPassword("tamper-me-123", tampered)).toBe(false);
	}, 15000);

	it("rejects tampered salt without throwing", async () => {
		const hash = await hashPassword("salt-tamper-1");
		const parts = hash.split("$");
		const salt = parts[2];
		const flippedSalt = `${salt.startsWith("A") ? "B" : "A"}${salt.slice(1)}`;
		const tampered = [parts[0], parts[1], flippedSalt, parts[3]].join("$");
		expect(await verifyPassword("salt-tamper-1", tampered)).toBe(false);
	}, 15000);
});
