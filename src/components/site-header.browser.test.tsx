import "#/styles.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { SiteHeader } from "./site-header";

test("site header links home, agent guide, and OpenAPI", async () => {
	const screen = await render(<SiteHeader />);
	const brand = screen.getByRole("link", { name: "dilly dally" });
	await expect.element(brand).toHaveAttribute("href", "/");
	const guide = screen.getByRole("link", { name: "Agent guide" });
	await expect.element(guide).toHaveAttribute("href", "/api/agent-guide");
	const openapi = screen.getByRole("link", { name: "OpenAPI" });
	await expect.element(openapi).toHaveAttribute("href", "/api/openapi.json");
});
