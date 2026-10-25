import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs from "sql.js";
import type { DrizzleDb } from "./db";
import * as schema from "./schema";

export async function createTestDb(): Promise<{ db: DrizzleDb }> {
	const wasmPath = join(
		process.cwd(),
		"node_modules",
		"sql.js",
		"dist",
		"sql-wasm.wasm",
	);
	const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });
	const sqlDb = new SQL.Database();
	sqlDb.exec("PRAGMA foreign_keys = ON;");
	const migDir = join(process.cwd(), "migrations", "drizzle");
	const files = readdirSync(migDir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	if (files.length === 0) throw new Error("No drizzle migrations found");
	for (const f of files) {
		const sql = readFileSync(join(migDir, f), "utf8");
		for (const stmt of sql.split("--> statement-breakpoint")) {
			const s = stmt.trim();
			if (s) sqlDb.exec(s);
		}
	}
	const db = drizzle(sqlDb, { schema });
	return { db: db as unknown as DrizzleDb };
}

export interface QueryCounterState {
	batches: number;
	maxInFlight: number;
	queries: number;
}

function wrapQueryBuilder(
	target: object,
	state: QueryCounterState & { inFlight: number },
): unknown {
	return new Proxy(target, {
		get(t, p) {
			if (p === "then") {
				const original = Reflect.get(t, p);
				if (typeof original !== "function") return original;
				return (onFulfilled: unknown, onRejected: unknown) => {
					state.queries += 1;
					state.inFlight += 1;
					state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
					const settle = (fn: unknown) => (value: unknown) => {
						state.inFlight -= 1;
						return typeof fn === "function"
							? (fn as (v: unknown) => unknown)(value)
							: value;
					};
					return (original as (...args: unknown[]) => Promise<unknown>).call(
						t,
						settle(onFulfilled),
						settle(onRejected),
					);
				};
			}
			const value = Reflect.get(t, p);
			if (typeof value === "function") {
				return (...args: unknown[]) => {
					const next = Reflect.apply(value, t, args);
					return typeof next === "object" && next !== null
						? wrapQueryBuilder(next, state)
						: next;
				};
			}
			if (typeof value === "object" && value !== null)
				return wrapQueryBuilder(value, state);
			return value;
		},
	});
}

export function withQueryCounter(db: DrizzleDb): {
	db: DrizzleDb;
	state: QueryCounterState;
} {
	const state: QueryCounterState & { inFlight: number } = {
		batches: 0,
		inFlight: 0,
		maxInFlight: 0,
		queries: 0,
	};
	const proxied = new Proxy(db, {
		get(t, p) {
			const value = Reflect.get(t, p);
			if (typeof value === "function") {
				if (p === "batch") {
					return async (...args: unknown[]) => {
						state.batches += 1;
						state.inFlight += 1;
						state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
						try {
							return await Reflect.apply(value, t, args);
						} finally {
							state.inFlight -= 1;
						}
					};
				}
				if (
					p === "select" ||
					p === "insert" ||
					p === "update" ||
					p === "delete"
				) {
					return (...args: unknown[]) => {
						const builder = Reflect.apply(value, t, args);
						return typeof builder === "object" && builder !== null
							? wrapQueryBuilder(builder, state)
							: builder;
					};
				}
			}
			return value;
		},
	});
	return { db: proxied as DrizzleDb, state };
}
