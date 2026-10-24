import "#/styles.css";
import { expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { weekdayName } from "./grid-model";
import { WeekdayPicker } from "./weekday-picker";

test("clicking a weekday toggles it", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<WeekdayPicker onCommit={onCommit} selected={new Set([1])} />,
	);

	const monday = screen.getByRole("button", { name: weekdayName(1, "long") });
	await expect.element(monday).toBeVisible();
	await monday.click();
	expect(onCommit).toHaveBeenCalledTimes(1);
	expect(onCommit.mock.calls[0]?.[0].has(1)).toBe(false);
});

test("dragging across weekdays selects every day in between", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<WeekdayPicker onCommit={onCommit} selected={new Set()} />,
	);

	const first = screen.getByRole("button", { name: weekdayName(1, "long") });
	const last = screen.getByRole("button", { name: weekdayName(4, "long") });
	await expect.element(first).toBeVisible();
	await first.dropTo(last);
	expect(onCommit).toHaveBeenCalledTimes(1);
	expect([...(onCommit.mock.calls[0]?.[0] as Set<number>)].sort()).toEqual([
		1, 2, 3, 4,
	]);
});

test("weekday paint surface allows touch scroll", async () => {
	const screen = await render(
		<WeekdayPicker onCommit={() => {}} selected={new Set()} />,
	);
	const monday = screen.getByRole("button", { name: weekdayName(1, "long") });
	await expect.element(monday).toBeVisible();
	const surface = monday.element().closest('[data-slot="toggle-group"]');
	expect(surface).not.toBeNull();
	expect(surface?.className ?? "").toContain("touch-pan-y");
	expect(surface?.className ?? "").not.toContain("touch-none");
});

test("pressed weekdays follow the paint preview, not just selection", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<WeekdayPicker onCommit={onCommit} selected={new Set([1])} />,
	);

	const monday = screen.getByRole("button", { name: weekdayName(1, "long") });
	const tuesday = screen.getByRole("button", { name: weekdayName(2, "long") });
	await expect.element(monday).toBeVisible();
	expect(monday.element().getAttribute("data-state")).toBe("on");
	expect(monday.element().getAttribute("aria-pressed")).toBe("true");
	expect(tuesday.element().getAttribute("data-state")).toBe("off");
	expect(tuesday.element().getAttribute("aria-pressed")).toBe("false");
});

test("trusted key presses toggle exactly once per press", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<WeekdayPicker onCommit={onCommit} selected={new Set()} />,
	);

	const monday = screen.getByRole("button", { name: weekdayName(1, "long") });
	await expect.element(monday).toBeVisible();
	(monday.element() as HTMLButtonElement).focus();
	await expect.element(monday).toHaveFocus();
	await userEvent.keyboard("{Enter}");
	expect(onCommit).toHaveBeenCalledTimes(1);
	await userEvent.keyboard(" ");
	expect(onCommit).toHaveBeenCalledTimes(2);
});

test("repeat keydown does not toggle the weekday", async () => {
	const onCommit = vi.fn();
	const screen = await render(
		<WeekdayPicker onCommit={onCommit} selected={new Set()} />,
	);

	const monday = screen.getByRole("button", { name: weekdayName(1, "long") });
	await expect.element(monday).toBeVisible();
	const node = monday.element() as HTMLButtonElement;
	node.focus();
	await expect.element(monday).toHaveFocus();
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
