import { and, eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core/db";
import { seed } from "drizzle-seed";
import type { DrizzleDb } from "./db";
import { computeExpiry } from "./expiry";
import { events, participants } from "./schema";
import { buildSlotUniverse } from "./time-slots";

export const DEMO_EVENT_IDS = ["DillyDemo001", "DillyDemo002"];

function mulberry32(a: number): () => number {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function datePlusDays(baseMs: number, days: number): string {
	return new Date(baseMs + days * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);
}

function randomSubset(
	universe: string[],
	rand: () => number,
	p = 0.45,
): string[] {
	return universe.filter(() => rand() < p);
}

export async function seedDemo(
	db: DrizzleDb,
	now: number = Date.now(),
): Promise<{ eventIds: string[]; participantCount: number }> {
	for (const id of DEMO_EVENT_IDS) {
		await db.delete(participants).where(eq(participants.eventId, id));
		await db.delete(events).where(eq(events.id, id));
	}

	const dates1 = [7, 8, 9, 12, 13].map((d) => datePlusDays(now, d));
	const event1 = {
		createdAt: now,
		datesJson: JSON.stringify(dates1),
		endTime: "17:00",
		expiresAt: computeExpiry({ createdAt: now, dates: dates1 }),
		id: DEMO_EVENT_IDS[0],
		startTime: "09:00",
		timezone: "America/New_York",
		title: "Demo: Team offsite",
	};
	const universe1 = buildSlotUniverse({
		dates: dates1,
		endTime: "17:00",
		startTime: "09:00",
	});
	await db.insert(events).values(event1);
	await db.insert(participants).values([
		{
			eventId: event1.id,
			nameDisplay: "Alice",
			nameKey: "alice",
			passwordHash: null,
			slotsJson: JSON.stringify(universe1.filter((_, i) => i % 2 === 0)),
			updatedAt: now,
		},
		{
			eventId: event1.id,
			nameDisplay: "Bob",
			nameKey: "bob",
			passwordHash: null,
			slotsJson: JSON.stringify(universe1.filter((_, i) => i % 3 !== 0)),
			updatedAt: now,
		},
	]);

	const rand = mulberry32(42);
	const subsetValues = Array.from({ length: 16 }, () =>
		JSON.stringify(randomSubset(universe1, rand)),
	);
	await seed(
		db as unknown as BaseSQLiteDatabase<"async", unknown>,
		{ participants },
		{ count: 12, seed: 42 },
	).refine((f) => ({
		participants: {
			columns: {
				eventId: f.default({ defaultValue: event1.id }),
				nameDisplay: f.fullName({ isUnique: true }),
				passwordHash: f.default({ defaultValue: null }),
				slotsJson: f.valuesFromArray({ isUnique: true, values: subsetValues }),
				updatedAt: f.default({ defaultValue: now }),
			},
		},
	}));

	const seeded = await db
		.select()
		.from(participants)
		.where(eq(participants.eventId, event1.id));
	const seen = new Set(["alice", "bob"]);
	for (const row of seeded) {
		const key = row.nameDisplay.trim().toLowerCase();
		const rowId = and(
			eq(participants.eventId, event1.id),
			eq(participants.nameKey, row.nameKey),
		);
		if (row.nameKey === key) {
			seen.add(key);
			continue;
		}
		if (seen.has(key)) {
			await db.delete(participants).where(rowId);
			continue;
		}
		seen.add(key);
		await db.delete(participants).where(rowId);
		await db.insert(participants).values({ ...row, nameKey: key });
	}

	const dates2 = [7, 8, 9].map((d) => datePlusDays(now, d));
	const event2 = {
		createdAt: now,
		datesJson: JSON.stringify(dates2),
		endTime: "14:00",
		expiresAt: computeExpiry({ createdAt: now, dates: dates2 }),
		id: DEMO_EVENT_IDS[1],
		startTime: "11:00",
		timezone: "America/New_York",
		title: "Demo: Lunch poll",
	};
	const universe2 = buildSlotUniverse({
		dates: dates2,
		endTime: "14:00",
		startTime: "11:00",
	});
	await db.insert(events).values(event2);
	await db.insert(participants).values({
		eventId: event2.id,
		nameDisplay: "Cara",
		nameKey: "cara",
		passwordHash: null,
		slotsJson: JSON.stringify(universe2.slice(0, 4)),
		updatedAt: now,
	});

	const all = await db
		.select()
		.from(participants)
		.where(eq(participants.eventId, event1.id));
	return { eventIds: DEMO_EVENT_IDS, participantCount: all.length };
}
