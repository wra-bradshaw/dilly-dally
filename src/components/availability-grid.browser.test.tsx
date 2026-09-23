import "#/styles.css";
import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
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

function twoColumns() {
	return buildColumns(
		[
			"2026-09-28T09:00",
			"2026-09-28T09:15",
			"2026-09-29T09:00",
			"2026-09-29T09:15",
		],
		"UTC",
		"UTC",
	);
}

function gapColumns() {
	return buildColumns(
		[
			"2026-09-28T09:00",
			"2026-09-28T09:15",
			"2026-10-01T09:00",
			"2026-10-01T09:15",
		],
		"UTC",
		"UTC",
	);
}

function midnightCrossingColumns() {
	return buildColumns(
		[
			"2026-10-05T19:00",
			"2026-10-05T20:00",
			"2026-10-05T21:00",
			"2026-10-05T22:00",
		],
		"America/New_York",
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

test("keyboard activation toggles the focused slot", async () => {
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
	const node = cell.element() as HTMLButtonElement;
	node.focus();
	await expect.element(cell).toHaveFocus();
	const event = new KeyboardEvent("keydown", {
		bubbles: true,
		cancelable: true,
		key: "Enter",
	});
	node.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);
	expect(onCommit).toHaveBeenCalledTimes(1);
	expect(onCommit.mock.calls[0]?.[0].has("2026-09-28T09:00")).toBe(true);
	node.dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: " ",
		}),
	);
	expect(onCommit).toHaveBeenCalledTimes(2);
});

test("repeat keydown does not toggle the focused slot", async () => {
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
	const node = cell.element() as HTMLButtonElement;
	node.focus();
	await expect.element(cell).toHaveFocus();
	node.dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "Enter",
			repeat: true,
		}),
	);
	expect(onCommit).not.toHaveBeenCalled();
	expect(
		node.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key: "Enter",
				repeat: true,
			}),
		),
	).toBe(false);
	node.dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
			key: "Enter",
		}),
	);
	expect(onCommit).not.toHaveBeenCalled();
});

test("trusted key presses toggle exactly once per press", async () => {
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
	(cell.element() as HTMLButtonElement).focus();
	await expect.element(cell).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	expect(onCommit).toHaveBeenCalledTimes(1);
	await userEvent.keyboard(" ");
	expect(onCommit).toHaveBeenCalledTimes(2);
});

test("Home and End jump focus across dates", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={twoColumns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);

	const first = screen.getByRole("button", { name: "Mon, 9/28 9:15 AM" });
	await expect.element(first).toBeVisible();
	(first.element() as HTMLButtonElement).focus();
	await expect.element(first).toHaveFocus();
	first.element().dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "End",
		}),
	);
	const last = screen.getByRole("button", { name: "Tue, 9/29 9:15 AM" });
	await expect.element(last).toHaveFocus();
	last.element().dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "Home",
		}),
	);
	await expect.element(first).toHaveFocus();
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
	await userEvent.keyboard("{ArrowDown}");
	const third = screen.getByRole("button", { name: "Mon, 9/28 9:30 AM" });
	await expect.element(third).toHaveFocus();
});

test("pointerdown focuses the cell without scrolling the page", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={columns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);

	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:15 AM" });
	await expect.element(cell).toBeVisible();
	const node = cell.element() as HTMLButtonElement;
	node.dispatchEvent(
		new PointerEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			pointerType: "mouse",
		}),
	);
	await expect.element(cell).toHaveFocus();
});

test("post-drag mouse clicks do not double-commit but keyboard clicks toggle", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<AvailabilityGrid
			columns={columns()}
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const first = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	const last = screen.getByRole("button", { name: "Mon, 9/28 9:30 AM" });
	await expect.element(first).toBeVisible();
	await first.dropTo(last);
	expect(onCommit).toHaveBeenCalledTimes(1);
	(first.element() as HTMLButtonElement).dispatchEvent(
		new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
	);
	expect(onCommit).toHaveBeenCalledTimes(1);
	(first.element() as HTMLButtonElement).dispatchEvent(
		new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 }),
	);
	expect(onCommit).toHaveBeenCalledTimes(2);
});

test("dragging across times paints every slot in between", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<AvailabilityGrid
			columns={columns()}
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const first = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	const last = screen.getByRole("button", { name: "Mon, 9/28 9:30 AM" });
	await expect.element(first).toBeVisible();
	await first.dropTo(last);
	expect(onCommit).toHaveBeenCalledTimes(1);
	const next = onCommit.mock.calls[0]?.[0] as Set<string>;
	expect([...next].sort()).toEqual([
		"2026-09-28T09:00",
		"2026-09-28T09:15",
		"2026-09-28T09:30",
	]);
});

test("dragging across dates paints the rectangle in between", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<AvailabilityGrid
			columns={twoColumns()}
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const first = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	const last = screen.getByRole("button", { name: "Tue, 9/29 9:15 AM" });
	await expect.element(first).toBeVisible();
	await first.dropTo(last);
	expect(onCommit).toHaveBeenCalledTimes(1);
	const next = onCommit.mock.calls[0]?.[0] as Set<string>;
	expect([...next].sort()).toEqual([
		"2026-09-28T09:00",
		"2026-09-28T09:15",
		"2026-09-29T09:00",
		"2026-09-29T09:15",
	]);
});

test("non-contiguous days show a visible gap with screen-reader text", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={gapColumns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	await expect.element(screen.getByText("+2")).toBeVisible();
	await expect
		.element(
			screen.getByText("Skipped 2 days between 2026-09-28 and 2026-10-01"),
		)
		.toBeVisible();
	await expect
		.element(screen.getByText("Showing 2 days in 2 groups, 2 days skipped."))
		.toBeVisible();
	const gapCell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(gapCell).toBeVisible();
});

test("viewer-time shift keeps every slot rendered and aligned", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={midnightCrossingColumns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	const buttons = screen.getByRole("button", { name: /AM|PM/ });
	await expect.element(buttons.first()).toBeVisible();
	expect(buttons.all()).toHaveLength(4);
});

test("shows a single inline date with no annotations", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={columns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	await expect.element(screen.getByText("Mon, 9/28")).toBeVisible();
	expect(screen.getByText("Sep 28").all()).toHaveLength(0);
	expect(screen.getByText("Shows as").all()).toHaveLength(0);
	expect(screen.getByText("+1d").all()).toHaveLength(0);
});

test("marks the day crossing inline above the midnight cell", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={midnightCrossingColumns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	await expect.element(screen.getByText("Mon, 10/5")).toBeVisible();
	await expect.element(screen.getByText("Tue, 10/6")).toBeVisible();
	const before = screen.getByRole("button", { name: "Mon, 10/5 11:00 PM" });
	const after = screen.getByRole("button", { name: "Tue, 10/6 12:00 AM" });
	await expect.element(before).toBeVisible();
	await expect.element(after).toBeVisible();
	const afterRow = after.element().closest("tr");
	const beforeRow = before.element().closest("tr");
	expect(afterRow?.previousElementSibling?.textContent).toContain("Tue, 10/6");
	expect(beforeRow?.nextElementSibling?.textContent).toContain("Tue, 10/6");
	expect(after.element().className).toContain("border-t-2");
});

test("paint surface presents touch-none at rest so touch drags paint", async () => {
	const screen = await render(
		<AvailabilityGrid
			columns={columns()}
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	const cell = screen.getByRole("button", { name: "Mon, 9/28 9:00 AM" });
	await expect.element(cell).toBeVisible();
	expect(cell.element().closest("table")?.className).toContain("touch-none");
	expect(
		getComputedStyle(cell.element().closest("table") as HTMLElement)
			.touchAction,
	).toBe("none");
});
