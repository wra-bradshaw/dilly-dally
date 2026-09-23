import { describe, expect, it } from "vitest";
import {
	computeExpiry,
	EVENT_GRACE_DAYS,
	EVENT_MAX_FUTURE_DAYS,
	EVENT_TTL_DAYS,
	isExpired,
} from "./expiry";

describe("computeExpiry", () => {
	it("uses last date plus grace unless 90-day cap hits first", () => {
		const createdAt = new Date("2026-09-22T00:00:00.000Z").getTime();
		const expiry = computeExpiry({
			createdAt,
			dates: ["2026-10-05"],
		});
		expect(expiry).toBeGreaterThan(createdAt);
		expect(new Date(expiry).toISOString()).toBe("2026-10-07T00:00:00.000Z");
	});

	it("keeps local-today events west of UTC alive at creation", () => {
		const createdAt = new Date("2026-09-23T00:00:00.000Z").getTime();
		const expiry = computeExpiry({
			createdAt,
			dates: ["2026-09-22"],
		});
		expect(isExpired(expiry, createdAt)).toBe(false);
		expect(new Date(expiry).toISOString()).toBe("2026-09-24T00:00:00.000Z");
	});

	it("caps at max window plus grace", () => {
		const createdAt = new Date("2026-09-22T00:00:00.000Z").getTime();
		const expiry = computeExpiry({
			createdAt,
			dates: ["2027-06-01"],
		});
		const max = createdAt + EVENT_TTL_DAYS * 24 * 60 * 60 * 1000;
		expect(expiry).toBe(max);
	});

	it("keeps a max-window event alive past its last date plus grace", () => {
		const createdAt = new Date("2026-09-22T12:00:00.000Z").getTime();
		const lastDate = new Date(createdAt + EVENT_MAX_FUTURE_DAYS * 86400000)
			.toISOString()
			.slice(0, 10);
		const expiry = computeExpiry({ createdAt, dates: [lastDate] });
		const graceEnd =
			new Date(`${lastDate}T00:00:00.000Z`).getTime() +
			EVENT_GRACE_DAYS * 86400000;
		expect(isExpired(expiry, createdAt)).toBe(false);
		expect(expiry).toBe(graceEnd);
		expect(expiry).toBeGreaterThan(
			new Date(`${lastDate}T00:00:00.000Z`).getTime(),
		);
	});
});

describe("isExpired", () => {
	it("detects expired timestamps", () => {
		expect(isExpired(Date.now() - 1000, Date.now())).toBe(true);
		expect(isExpired(Date.now() + 1000, Date.now())).toBe(false);
	});
});
