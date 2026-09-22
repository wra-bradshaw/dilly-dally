import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { DateCalendar } from "./date-calendar";

test("clicking a day selects that date for the new event", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const day = screen.getByRole("button", { name: "28" });
	await expect.element(day).toBeVisible();
	await day.click();
	expect(onCommit).toHaveBeenCalledTimes(1);
	expect(onCommit.mock.calls[0]?.[0].has("2026-09-28")).toBe(true);
});

test("dates outside the event window cannot be picked", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-09-28"
			minDate="2026-09-28"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const day = screen.getByRole("button", { name: "28" });
	await expect.element(day).toBeVisible();
	const offDay = screen.getByRole("button", { name: "22" });
	await expect.element(offDay).toBeDisabled();
});
