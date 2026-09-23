import { describe, expect, it, vi } from "vitest";
import { fetchEvent } from "./db";
import { createEventInDb, toEventDto } from "./server-events";
import { createTestDb } from "./test-db";
import type { CreateEventInput } from "./validation";

function futureDate(offsetDays: number): string {
	const d = new Date(
		Date.UTC(
			new Date().getUTCFullYear(),
			new Date().getUTCMonth(),
			new Date().getUTCDate() + offsetDays,
		),
	);
	return d.toISOString().slice(0, 10);
}

function datesInput(dates: string[]): CreateEventInput {
	return {
		dates,
		endTime: "10:00",
		mode: "dates",
		startTime: "09:00",
		timezone: "UTC",
		title: "Team sync",
	};
}

describe("toEventDto", () => {
	it("maps rows with ISO timestamps and defaults", () => {
		const dto = toEventDto({
			createdAt: 1_700_000_000_000,
			dates: ["2026-10-05"],
			endTime: "10:00",
			expiresAt: 1_800_000_000_000,
			id: "AbC123_-XyZ9",
			mode: "dates",
			startTime: "09:00",
			timezone: "UTC",
			title: "Team sync",
			weekdays: [],
		});
		expect(dto.id).toBe("AbC123_-XyZ9");
		expect(dto.createdAt).toBe(new Date(1_700_000_000_000).toISOString());
		expect(dto.expiresAt).toBe(new Date(1_800_000_000_000).toISOString());
		expect(dto.weekdays).toEqual([]);
	});
});

describe("createEventInDb", () => {
	it("sorts dates on insert", async () => {
		const { db } = await createTestDb();
		const d2 = futureDate(6);
		const d1 = futureDate(5);
		const created = await createEventInDb(
			db,
			datesInput([d2, d1]),
			1_700_000_000_000,
		);
		expect(created?.dates).toEqual([d1, d2]);
	});

	it("normalizes weekly weekdays and clears dates", async () => {
		const { db } = await createTestDb();
		const created = await createEventInDb(
			db,
			{
				endTime: "10:00",
				mode: "weekly",
				startTime: "09:00",
				timezone: "UTC",
				title: "Standup",
				weekdays: [5, 1, 5, 3],
			},
			1_700_000_000_000,
		);
		expect(created?.dates).toEqual([]);
		expect(created?.weekdays).toEqual([1, 3, 5]);
	});

	it("retries after an id collision", async () => {
		const { db } = await createTestDb();
		let calls = 0;
		const realInsert = db.insert.bind(db);
		const spy = vi.spyOn(db, "insert").mockImplementation(((
			...args: unknown[]
		) => {
			calls += 1;
			if (calls === 1) throw new Error("UNIQUE constraint failed: events.id");
			return (realInsert as (...a: unknown[]) => unknown)(...args);
		}) as never);
		try {
			const created = await createEventInDb(
				db,
				datesInput([futureDate(5)]),
				1_700_000_000_000,
			);
			expect(calls).toBeGreaterThan(1);
			expect(created?.id).toBeTruthy();
			expect(await fetchEvent(db, created?.id ?? "")).not.toBeNull();
		} finally {
			spy.mockRestore();
		}
	});

	it("returns null on non-collision errors", async () => {
		const { db } = await createTestDb();
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const insertSpy = vi.spyOn(db, "insert").mockImplementation((() => {
			throw new Error("disk I/O error");
		}) as never);
		try {
			const created = await createEventInDb(
				db,
				datesInput([futureDate(5)]),
				1_700_000_000_000,
			);
			expect(created).toBeNull();
			expect(spy).toHaveBeenCalledOnce();
		} finally {
			insertSpy.mockRestore();
			spy.mockRestore();
		}
	});
});
