import "#/styles.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { WeekdayPicker } from "./weekday-picker";

test("weekday buttons expose full names to assistive tech", async () => {
	const screen = await render(
		<div>
			<span id="weekdays-label">What weekdays might work?</span>
			<p id="weekdays-hint">Availability means that weekday generally.</p>
			<WeekdayPicker
				describedBy="weekdays-hint"
				labelledBy="weekdays-label"
				onCommit={() => {}}
				selected={new Set([1])}
			/>
		</div>,
	);
	const monday = screen.getByRole("button", { name: "Monday" });
	await expect.element(monday).toBeVisible();
	expect(monday.element().getAttribute("title")).toBe("Monday");
	const group = screen.container.querySelector('[data-slot="toggle-group"]');
	expect(group?.getAttribute("aria-labelledby")).toBe("weekdays-label");
	expect(group?.getAttribute("aria-describedby")).toBe("weekdays-hint");
});
