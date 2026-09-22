import { execSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs from "sql.js";
import type { DrizzleDb } from "../src/lib/db.ts";
import * as schema from "../src/lib/schema.ts";
import { DEMO_EVENT_IDS, seedDemo } from "../src/lib/seed.ts";

function sqlString(v: string | null): string {
	if (v === null) return "NULL";
	return `'${v.replace(/'/g, "''")}'`;
}

async function main() {
	const wasmPath = join(
		process.cwd(),
		"node_modules",
		"sql.js",
		"dist",
		"sql-wasm.wasm",
	);
	const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) });
	const sqlDb = new SQL.Database();
	const migDir = join(process.cwd(), "migrations", "drizzle");
	for (const f of readdirSync(migDir)
		.filter((x) => x.endsWith(".sql"))
		.sort()) {
		const sql = readFileSync(join(migDir, f), "utf8");
		for (const stmt of sql.split("--> statement-breakpoint")) {
			const s = stmt.trim();
			if (s) sqlDb.exec(s);
		}
	}
	const db = drizzle(sqlDb, { schema }) as unknown as DrizzleDb;
	const summary = await seedDemo(db);
	const evRows = await db.select().from(schema.events);
	const pRows = await db.select().from(schema.participants);
	const ids = DEMO_EVENT_IDS.map((id) => `'${id}'`).join(", ");
	const lines: string[] = [
		`DELETE FROM participants WHERE event_id IN (${ids});`,
		`DELETE FROM events WHERE id IN (${ids});`,
	];
	for (const e of evRows) {
		lines.push(
			`INSERT INTO events (id, title, dates_json, start_time, end_time, timezone, created_at, expires_at) VALUES (${sqlString(e.id)}, ${sqlString(e.title)}, ${sqlString(e.datesJson)}, ${sqlString(e.startTime)}, ${sqlString(e.endTime)}, ${sqlString(e.timezone)}, ${e.createdAt}, ${e.expiresAt});`,
		);
	}
	for (const p of pRows) {
		lines.push(
			`INSERT INTO participants (event_id, name_key, name_display, password_hash, slots_json, updated_at) VALUES (${sqlString(p.eventId)}, ${sqlString(p.nameKey)}, ${sqlString(p.nameDisplay)}, ${sqlString(p.passwordHash)}, ${sqlString(p.slotsJson)}, ${p.updatedAt});`,
		);
	}
	writeFileSync(join(process.cwd(), "scripts", "seed.sql"), `${lines.join("\n")}\n`);
	console.log(
		`Seeded ${summary.participantCount} participants across ${summary.eventIds.length} demo events.`,
	);
	execSync("pnpm exec wrangler d1 migrations apply dilly-dally --local", {
		stdio: "inherit",
	});
	execSync(
		"pnpm exec wrangler d1 execute dilly-dally --local --file=./scripts/seed.sql",
		{ stdio: "inherit" },
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
