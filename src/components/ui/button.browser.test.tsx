import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { Button } from "./button";

test("renders button and handles click in real Chromium", async () => {
	let clicked = 0;
	const screen = await render(
		<Button onClick={() => clicked++}>Click me</Button>,
	);

	const button = screen.getByRole("button", { name: "Click me" });
	await expect.element(button).toBeVisible();
	await button.click();
	expect(clicked).toBe(1);
});
