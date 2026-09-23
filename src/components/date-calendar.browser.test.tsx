import "#/styles.css";
import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
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
			minDate="2026-09-23"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const day = screen.getByRole("button", { name: "Mon, 9/28" });
	await expect.element(day).toBeVisible();
	expect(screen.container.querySelector('[data-day="2026-09-22"]')).toBeNull();
	const filler = screen.container.querySelectorAll("[data-filler]");
	expect(filler.length).toBeGreaterThan(0);
	expect(
		screen.container.querySelector('button[aria-hidden="true"]'),
	).toBeNull();
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

test("arrow keys never scroll even with nowhere to move", async () => {
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
	(day.element() as HTMLButtonElement).focus();
	await expect.element(day).toHaveFocus();
	for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
		const cancelled = !(day.element() as HTMLButtonElement).dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key,
			}),
		);
		expect(cancelled).toBe(true);
	}
	await expect.element(day).toHaveFocus();
});

test("renders every in-range month stacked with no month buttons", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	await expect.element(screen.getByText("September 2026")).toBeVisible();
	await expect.element(screen.getByText("October 2026")).toBeVisible();
	expect(
		screen.container.querySelector('[aria-label="Previous month"]'),
	).toBeNull();
	expect(
		screen.container.querySelector('[aria-label="Next month"]'),
	).toBeNull();
	expect(
		screen.container.querySelector('[data-day="2026-09-30"]'),
	).not.toBeNull();
	expect(
		screen.container.querySelector('[data-day="2026-10-01"]'),
	).not.toBeNull();
});

test("leading out-of-range weeks are trimmed, not blank space", async () => {
	const screen = await render(
		<DateCalendar
			maxDate="2026-09-30"
			minDate="2026-09-22"
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);

	await expect.element(screen.getByText("September 2026")).toBeVisible();
	expect(screen.container.querySelector('[data-day="2026-09-01"]')).toBeNull();
	expect(
		screen.container.querySelector('[data-day="2026-09-22"]'),
	).not.toBeNull();
});

test("dragging near the bottom edge scrolls the month list", async () => {
	const screen = await render(
		<DateCalendar
			maxDate="2026-12-31"
			minDate="2026-09-22"
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);

	const scroller = screen.container.querySelector<HTMLElement>(
		'[data-slot="date-calendar-months"]',
	);
	expect(scroller).not.toBeNull();
	const el = scroller as HTMLElement;
	expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);
	const day = screen.getByRole("button", { name: "Mon, 9/28" });
	await expect.element(day).toBeVisible();
	(day.element() as HTMLButtonElement).dispatchEvent(
		new PointerEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			pointerType: "mouse",
		}),
	);
	await new Promise((resolve) => setTimeout(resolve, 10));
	const rect = el.getBoundingClientRect();
	el.dispatchEvent(
		new PointerEvent("pointermove", {
			bubbles: true,
			button: 0,
			buttons: 1,
			cancelable: true,
			clientX: rect.left + rect.width / 2,
			clientY: rect.bottom - 4,
		}),
	);
	expect(el.scrollTop).toBeGreaterThan(0);
});

test("deeper edge penetration scrolls faster than shallow", async () => {
	const screen = await render(
		<DateCalendar
			maxDate="2026-12-31"
			minDate="2026-09-22"
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);

	const scroller = screen.container.querySelector<HTMLElement>(
		'[data-slot="date-calendar-months"]',
	);
	expect(scroller).not.toBeNull();
	const el = scroller as HTMLElement;
	const day = screen.getByRole("button", { name: "Mon, 9/28" });
	await expect.element(day).toBeVisible();
	(day.element() as HTMLButtonElement).dispatchEvent(
		new PointerEvent("pointerdown", {
			bubbles: true,
			button: 0,
			cancelable: true,
			pointerType: "mouse",
		}),
	);
	await new Promise((resolve) => setTimeout(resolve, 10));
	const rect = el.getBoundingClientRect();
	const centerY = rect.top + rect.height / 2;
	const moveTo = (clientY: number) => {
		el.dispatchEvent(
			new PointerEvent("pointermove", {
				bubbles: true,
				button: 0,
				buttons: 1,
				cancelable: true,
				clientX: rect.left + rect.width / 2,
				clientY,
			}),
		);
	};
	el.scrollTop = 0;
	moveTo(rect.bottom - 35);
	const shallow = el.scrollTop;
	moveTo(centerY);
	el.scrollTop = 0;
	moveTo(rect.bottom - 4);
	const deep = el.scrollTop;
	expect(shallow).toBeGreaterThan(0);
	expect(deep).toBeGreaterThan(shallow);
	el.dispatchEvent(
		new PointerEvent("pointerup", {
			bubbles: true,
			cancelable: true,
			clientX: rect.left + rect.width / 2,
			clientY: rect.bottom - 4,
		}),
	);
});

test("weekday header sticks to the top while scrolling", async () => {
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	const header = screen.container.querySelector<HTMLElement>(
		'[data-slot="date-calendar-weekdays"]',
	);
	expect(header).not.toBeNull();
	expect(header?.className ?? "").toContain("sticky");
	expect(getComputedStyle(header as HTMLElement).position).toBe("sticky");
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

test("dragging across months selects every date in between", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const first = screen.getByRole("button", { name: "Wed, 9/30" });
	const last = screen.getByRole("button", { name: "Fri, 10/2" });
	await expect.element(first).toBeVisible();
	await first.dropTo(last);
	expect(onCommit).toHaveBeenCalledTimes(1);
	const next = onCommit.mock.calls[0]?.[0] as Set<string>;
	expect([...next].sort()).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
});

test("Home and End jump to row edges", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={onCommit}
			selected={new Set()}
		/>,
	);

	const mid = screen.getByRole("button", { name: "Thu, 9/24" });
	await expect.element(mid).toBeVisible();
	(mid.element() as HTMLButtonElement).focus();
	await expect.element(mid).toHaveFocus();
	mid.element().dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "Home",
		}),
	);
	await expect
		.element(screen.getByRole("button", { name: "Tue, 9/22" }))
		.toHaveFocus();
	const edge = screen.getByRole("button", { name: "Tue, 9/22" });
	edge.element().dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "End",
		}),
	);
	await expect
		.element(screen.getByRole("button", { name: "Sat, 9/26" }))
		.toHaveFocus();
	expect(onCommit).not.toHaveBeenCalled();
	expect(
		screen.container.querySelectorAll('button[data-day][tabindex="0"]'),
	).toHaveLength(1);
});

test("calendar paint surface presents touch-none at rest", async () => {
	const screen = await render(
		<DateCalendar
			maxDate="2026-10-31"
			minDate="2026-09-22"
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	const day = screen.getByRole("button", { name: "Mon, 9/28" });
	await expect.element(day).toBeVisible();
	const surface = day.element().closest(".touch-none");
	expect(surface).not.toBeNull();
	expect(surface?.className ?? "").toContain("touch-none");
	expect(getComputedStyle(surface as HTMLElement).touchAction).toBe("none");
});

test("trusted key presses toggle exactly once per press", async () => {
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
	(day.element() as HTMLButtonElement).focus();
	await expect.element(day).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	expect(onCommit).toHaveBeenCalledTimes(1);
	await userEvent.keyboard(" ");
	expect(onCommit).toHaveBeenCalledTimes(2);
});

test("repeat keydown does not toggle the day", async () => {
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
	node.focus();
	await expect.element(day).toHaveFocus();
	node.dispatchEvent(
		new KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			key: "Enter",
			repeat: true,
		}),
	);
	expect(onCommit).not.toHaveBeenCalled();
});
