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
