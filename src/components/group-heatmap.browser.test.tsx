import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { buildColumns } from "./grid-model";
import { GroupHeatmap } from "./group-heatmap";

function crossingColumns() {
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

function singleColumn() {
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
test("heatmap shares inline date markers with the paint grid", async () => {
	const cols = crossingColumns();
	const counts = new Map(
		cols.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 0, names: [] }]),
		),
	);
	const screen = await render(
		<GroupHeatmap
			allNames={[]}
			columns={cols}
			counts={counts}
			eventTimezone="America/New_York"
			total={0}
			viewTimezone="UTC"
		/>,
	);
	await expect.element(screen.getByText("Mon, 10/5")).toBeVisible();
	await expect.element(screen.getByText("Tue, 10/6")).toBeVisible();
	expect(screen.getByText("Shows as").all()).toHaveLength(0);
});

test("arrow keys move focus between heatmap slots and announce counts", async () => {
	const cols = singleColumn();
	const counts = new Map(
		cols.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
	const screen = await render(
		<GroupHeatmap
			allNames={["Ada"]}
			columns={cols}
			counts={counts}
			eventTimezone="UTC"
			total={1}
			viewTimezone="UTC"
		/>,
	);
	const first = screen.getByRole("button", { name: /9:00 AM/ });
	await expect.element(first).toBeVisible();
	await first.click();
	first.element().dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "ArrowDown",
		}),
	);
	const second = screen.getByRole("button", { name: /9:15 AM/ });
	await expect.element(second).toHaveFocus();
	await expect.element(screen.getByText("1/1 available")).toBeVisible();
});

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

function press(el: { element: () => Element }, key: string) {
	el.element().dispatchEvent(
		new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key }),
	);
}

test("Escape clears the hovered panel", async () => {
	const cols = singleColumn();
	const counts = new Map(
		cols.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
	const screen = await render(
		<GroupHeatmap
			allNames={["Ada"]}
			columns={cols}
			counts={counts}
			eventTimezone="UTC"
			total={1}
			viewTimezone="UTC"
		/>,
	);
	const first = screen.getByRole("button", { name: /9:00 AM/ });
	await expect.element(first).toBeVisible();
	await first.click();
	await expect.element(screen.getByText("1/1 available")).toBeVisible();
	press(first, "Escape");
	await expect
		.element(screen.getByText(/Hover or tap a time slot/))
		.toBeVisible();
});

test("leaving a hovered cell clears the panel when nothing is tapped", async () => {
	const cols = singleColumn();
	const counts = new Map(
		cols.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
	const screen = await render(
		<GroupHeatmap
			allNames={["Ada"]}
			columns={cols}
			counts={counts}
			eventTimezone="UTC"
			total={1}
			viewTimezone="UTC"
		/>,
	);
	const first = screen.getByRole("button", { name: /9:00 AM/ });
	await expect.element(first).toBeVisible();
	await first.hover();
	await expect.element(screen.getByText("1/1 available")).toBeVisible();
	await screen.getByText("Available").hover();
	await expect
		.element(screen.getByText(/Hover or tap a time slot/))
		.toBeVisible();
});

test("heatmap arrows move Up Left Right with roving tabindex", async () => {
	const cols = twoColumns();
	const counts = new Map(
		cols.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
	const screen = await render(
		<GroupHeatmap
			allNames={["Ada"]}
			columns={cols}
			counts={counts}
			eventTimezone="UTC"
			total={1}
			viewTimezone="UTC"
		/>,
	);
	const lower = screen.getByRole("button", { name: /9\/28 9:15 AM/ });
	await lower.click();
	press(lower, "ArrowUp");
	const upper = screen.getByRole("button", { name: /9\/28 9:00 AM/ });
	await expect.element(upper).toHaveFocus();
	press(upper, "ArrowRight");
	const nextDay = screen.getByRole("button", { name: /9\/29 9:00 AM/ });
	await expect.element(nextDay).toHaveFocus();
	press(nextDay, "ArrowLeft");
	await expect.element(upper).toHaveFocus();
	await expect.element(nextDay).toHaveAttribute("tabindex", "-1");
	await expect.element(upper).toHaveAttribute("tabindex", "0");
});
