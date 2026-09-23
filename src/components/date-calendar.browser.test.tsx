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

	const day = screen.getByRole("button", { name: "Mon, 9/28" });
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

	const day = screen.getByRole("button", { name: "Mon, 9/28" });
	await expect.element(day).toBeVisible();
	const offDay = screen.container.querySelector<HTMLButtonElement>(
		'[data-day="2026-09-22"]',
	);
	expect(offDay?.disabled).toBe(true);
	expect(offDay?.getAttribute("aria-hidden")).toBe("true");
});

test("pointerdown focuses the day without scrolling the page", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const day = screen.getByRole("button", { name: "Mon, 9/28" });
	await expect.element(day).toBeVisible();
	const node = day.element() as HTMLButtonElement;
	node.dispatchEvent(
		new PointerEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			pointerType: "mouse",
		}),
	);
	await expect.element(day).toHaveFocus();
});

test("calendar exposes a single tab stop and arrows move focus", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const tabbable = screen.container.querySelectorAll(
		'button[data-day][tabindex="0"]',
	);
	expect(tabbable).toHaveLength(1);
	expect(tabbable[0]?.getAttribute("data-day")).toBe("2026-09-22");

	const first = screen.getByRole("button", { name: "Tue, 9/22" });
	await expect.element(first).toBeVisible();
	(first.element() as HTMLButtonElement).focus();
	await expect.element(first).toHaveFocus();
	first.element().dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "ArrowRight",
		}),
	);
	await expect
		.element(screen.getByRole("button", { name: "Wed, 9/23" }))
		.toHaveFocus();
	screen
		.getByRole("button", { name: "Wed, 9/23" })
		.element()
		.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key: "ArrowDown",
			}),
		);
	await expect
		.element(screen.getByRole("button", { name: "Wed, 9/30" }))
		.toHaveFocus();
	expect(onCommit).not.toHaveBeenCalled();
	expect(
		screen.container.querySelectorAll('button[data-day][tabindex="0"]'),
	).toHaveLength(1);
});

test("dragging across days selects every date in between", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const first = screen.getByRole("button", { name: "Thu, 9/24" });
	const last = screen.getByRole("button", { name: "Sun, 9/27" });
	await expect.element(first).toBeVisible();
	await first.dropTo(last);
	expect(onCommit).toHaveBeenCalledTimes(1);
	const next = onCommit.mock.calls[0]?.[0] as Set<string>;
	expect([...next].sort()).toEqual([
		"2026-09-24",
		"2026-09-25",
		"2026-09-26",
		"2026-09-27",
	]);
});
