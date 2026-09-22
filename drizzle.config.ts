import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	out: "./migrations/drizzle",
	schema: "./src/lib/schema.ts",
});
