import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { AvailabilityGrid } from "./availability-grid";
import { buildColumns } from "./grid-model";

function columns() {
	return buildColumns(
		[
			"2026-09-28T09:00",
			"2026-09-28T09:15",
			"2026-09-28T09:30",
			"2026-09-28T09:45",
		],
		"UTC",
		"UTC",
	);
}

test("clicking a free slot paints it available and commits", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<AvailabilityGrid
			columns={columns()}
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(cell).toBeVisible();
	await cell.click();
	expect(onCommit).toHaveBeenCalledTimes(1);
	expect(onCommit.mock.calls[0]?.[0].has("2026-09-28T09:00")).toBe(true);
});

test("arrow keys move focus between slots for keyboard painters", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={columns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);

	const first = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await first.click();
	first.element().dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "ArrowDown",
		}),
	);
	const second = screen.getByRole("button", { name: "Mon, 9/28 9:15 AM" });
	await expect.element(second).toHaveFocus();
});
