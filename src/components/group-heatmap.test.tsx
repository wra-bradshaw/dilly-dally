import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildColumns } from "./grid-model";
import { GroupHeatmap } from "./group-heatmap";

function cols() {
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

function counts() {
	return new Map(
		cols().flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
}

function ui() {
	return (
		<GroupHeatmap
			allNames={["Ada"]}
			columns={cols()}
			counts={counts()}
			eventTimezone="UTC"
			total={1}
			viewTimezone="UTC"
		/>
	);
}

describe("GroupHeatmap hover focus", () => {
	it("keeps the keyboard-focused panel when the mouse leaves another cell", () => {
		render(ui());
		const [first, second] = screen.getAllByRole("button");
		fireEvent.mouseEnter(first as HTMLElement);
		fireEvent.focus(second as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.mouseLeave(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
	});

	it("clears the panel when the mouse leaves the hovered cell", () => {
		render(ui());
		const [first] = screen.getAllByRole("button");
		fireEvent.mouseEnter(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.mouseLeave(first as HTMLElement);
		expect(screen.queryByText("1/1 available")).toBeNull();
	});

	it("clears the panel on tab-out", () => {
		render(ui());
		const [first] = screen.getAllByRole("button");
		fireEvent.focus(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.blur(first as HTMLElement);
		expect(screen.queryByText("1/1 available")).toBeNull();
	});

	it("keeps a tapped cell through a trailing emulated mouseleave", () => {
		render(ui());
		const [first] = screen.getAllByRole("button");
		fireEvent.click(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.mouseLeave(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
	});

	it("restores the tapped cell after hovering and leaving another cell", () => {
		const columns = cols();
		const ids = columns.flatMap((c) => c.cells.map((cell) => cell.id));
		const mixed = new Map(
			ids.map((id, i) => [
				id,
				{ count: i === 0 ? 1 : 2, names: i === 0 ? ["Ada"] : ["Ada", "Bo"] },
			]),
		);
		render(
			<GroupHeatmap
				allNames={["Ada", "Bo"]}
				columns={columns}
				counts={mixed}
				eventTimezone="UTC"
				total={2}
				viewTimezone="UTC"
			/>,
		);
		const [first, second] = screen.getAllByRole("button");
		fireEvent.click(first as HTMLElement);
		expect(screen.getByText("Unavailable")).toBeVisible();
		fireEvent.mouseEnter(second as HTMLElement);
		expect(screen.queryByText("Unavailable")).toBeNull();
		fireEvent.mouseLeave(second as HTMLElement);
		expect(screen.getByText("Unavailable")).toBeVisible();
	});

	it("clears a tapped cell on Escape", () => {
		render(ui());
		const [first] = screen.getAllByRole("button");
		fireEvent.click(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.keyDown(first as HTMLElement, { key: "Escape" });
		expect(screen.queryByText("1/1 available")).toBeNull();
	});
});
