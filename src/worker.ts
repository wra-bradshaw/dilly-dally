import handler from "@tanstack/react-start/server-entry";
import { drizzle } from "drizzle-orm/d1";
import { purgeExpired } from "./lib/db";
import * as schema from "./lib/schema";

export default {
	fetch: handler.fetch,
	async scheduled(
		_controller: ScheduledController,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<void> {
		const db = drizzle(env.DB, { schema });
		await purgeExpired(db, Date.now());
	},
};
