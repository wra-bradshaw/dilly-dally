import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), react()],
	resolve: {
		tsconfigPaths: true,
		alias: {
			"cloudflare:workers": fileURLToPath(
				new URL("./vitest.cloudflare-stub.ts", import.meta.url),
			),
		},
	},
	test: {
		setupFiles: ["./vitest.setup.ts"],
		projects: [
			{
				test: {
					name: "unit",
					environment: "jsdom",
					include: ["src/**/*.{test,spec}.{ts,tsx}"],
					exclude: [
						"src/**/*.browser.{test,spec}.{ts,tsx}",
						"**/node_modules/**",
					],
				},
			},
			{
				test: {
					name: "browser",
					include: ["src/**/*.browser.{test,spec}.{ts,tsx}"],
					exclude: ["**/node_modules/**"],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
