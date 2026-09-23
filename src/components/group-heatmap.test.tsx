import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvailabilityGrid } from "./availability-grid";
import { buildColumns } from "./grid-model";
import { GroupHeatmap, heatmapAnnounce, heatmapFill } from "./group-heatmap";

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

describe("GroupHeatmap colors", () => {
	it("matches the paint grid exactly when everyone is available", () => {
		expect(heatmapFill(2, 2)).toContain("bg-emerald-400");
		expect(heatmapFill(2, 2)).toContain("border-emerald-800");
		expect(heatmapFill(2, 2)).toContain("dark:bg-emerald-700");
		expect(heatmapFill(2, 2)).toContain("dark:border-emerald-300");
	});

	it("dims as availability decreases from full", () => {
		const full = heatmapFill(4, 4);
		const partial = heatmapFill(2, 4);
		const low = heatmapFill(1, 4);
		expect(partial).not.toBe(full);
		expect(low).not.toBe(full);
		expect(low).not.toBe(partial);
		expect(partial).toContain("bg-emerald-");
		expect(low).toContain("bg-emerald-");
	});

	it("uses the same emerald fill as the paint grid for filled cells", () => {
		render(ui());
		const filled = screen
			.getAllByRole("button")
			.map((b) => b as HTMLElement)
			.find((b) => b.textContent === "1");
		expect(filled?.style.backgroundColor ?? "").toBe("");
		expect(filled?.className ?? "").toContain("bg-emerald-400");
		expect(filled?.className ?? "").toContain("border-emerald-800");
		expect(filled?.className ?? "").toContain("dark:bg-emerald-700");
		expect(filled?.className ?? "").toContain("dark:border-emerald-300");
	});

	it("dims partial availability instead of reusing the full fill", () => {
		const columns = cols();
		const ids = columns.flatMap((c) => c.cells.map((cell) => cell.id));
		const mixed = new Map(
			ids.map((id, i) => [
				id,
				i === 0
					? { count: 1, names: ["Ada"] as string[] }
					: { count: 2, names: ["Ada", "Bo"] },
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
		expect((first as HTMLElement).className).not.toContain("bg-emerald-400");
		expect((first as HTMLElement).className).toContain("bg-emerald-");
		expect((second as HTMLElement).className).toContain("bg-emerald-400");
	});

	it("never underlines the counts", () => {
		render(ui());
		for (const b of screen.getAllByRole("button")) {
			expect((b as HTMLElement).className).not.toContain("underline");
		}
	});

	it("uses the same rose fill as the paint grid for empty cells", () => {
		const columns = cols();
		const ids = columns.flatMap((c) => c.cells.map((cell) => cell.id));
		const mixed = new Map(
			ids.map((id, i) => [
				id,
				i === 0
					? { count: 0, names: [] as string[] }
					: { count: 1, names: ["Ada"] },
			]),
		);
		render(
			<GroupHeatmap
				allNames={["Ada"]}
				columns={columns}
				counts={mixed}
				eventTimezone="UTC"
				total={1}
				viewTimezone="UTC"
			/>,
		);
		const [first, second] = screen.getAllByRole("button");
		expect((first as HTMLElement).style.backgroundColor).toBe("");
		expect((first as HTMLElement).className).toContain("bg-rose-100");
		expect((first as HTMLElement).className).toContain("border-rose-600");
		expect((second as HTMLElement).style.backgroundColor).toBe("");
		expect((second as HTMLElement).className).toContain("bg-emerald-400");
	});

	it("renders date markers smaller than the old text-xs size", () => {
		const { container } = render(ui());
		const marker = container.querySelector("thead, tbody")?.parentElement;
		expect(marker).toBeTruthy();
		const label = container.querySelector("div.text-\\[11px\\]");
		expect(label?.textContent).toMatch(/Mon|Tue/);
	});
});

describe("TimeGrid announcements", () => {
	it("announces by default for single-grid usages", () => {
		const { container } = render(ui());
		expect(container.querySelectorAll("output.sr-only")).toHaveLength(1);
	});

	it("routes the heatmap live region from sign-in state", () => {
		expect(heatmapAnnounce(true)).toBe(false);
		expect(heatmapAnnounce(false)).toBe(true);
	});

	it("emits one live region when signed in and the heatmap is silenced", () => {
		const columns = cols();
		const signedIn = true;
		const { container } = render(
			<>
				<AvailabilityGrid
					columns={columns}
					onCommit={() => {}}
					selected={new Set()}
				/>
				<GroupHeatmap
					allNames={["Ada"]}
					announce={heatmapAnnounce(signedIn)}
					columns={columns}
					counts={
						new Map(
							columns.flatMap((c) =>
								c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
							),
						)
					}
					eventTimezone="UTC"
					total={1}
					viewTimezone="UTC"
				/>
			</>,
		);
		expect(container.querySelectorAll("output.sr-only")).toHaveLength(1);
	});

	it("emits one live region when signed out and only the heatmap announces", () => {
		const columns = cols();
		const signedIn = false;
		const { container } = render(
			<GroupHeatmap
				allNames={["Ada"]}
				announce={heatmapAnnounce(signedIn)}
				columns={columns}
				counts={
					new Map(
						columns.flatMap((c) =>
							c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
						),
					)
				}
				eventTimezone="UTC"
				total={1}
				viewTimezone="UTC"
			/>,
		);
		expect(container.querySelectorAll("output.sr-only")).toHaveLength(1);
	});
});

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

	it("previews the hovered cell and restores the focused cell on leave", () => {
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
		fireEvent.focus(first as HTMLElement);
		expect(screen.getByText("Unavailable")).toBeVisible();
		fireEvent.mouseEnter(second as HTMLElement);
		expect(screen.getByText("2/2 available")).toBeVisible();
		fireEvent.mouseLeave(second as HTMLElement);
		expect(screen.getByText("Unavailable")).toBeVisible();
	});

	it("clears focus tracking on Escape so hover works again", () => {
		render(ui());
		const [first, second] = screen.getAllByRole("button");
		fireEvent.focus(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.keyDown(first as HTMLElement, { key: "Escape" });
		expect(screen.getByText(/Hover or tap a time slot/)).toBeVisible();
		fireEvent.mouseEnter(second as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.mouseLeave(second as HTMLElement);
		expect(screen.getByText(/Hover or tap a time slot/)).toBeVisible();
	});

	it("ignores right-click pointerdown so it does not steal focus", () => {
		render(ui());
		const [first] = screen.getAllByRole("button");
		(first as HTMLElement).focus();
		const other = screen.getAllByRole("button")[1] as HTMLElement;
		fireEvent.pointerDown(other, { button: 2, pointerType: "mouse" });
		expect(document.activeElement).toBe(first);
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
		expect(screen.getByText(/Hover or tap a time slot/)).toBeVisible();
	});

	it("clears a tapped cell on blur", () => {
		render(ui());
		const [first] = screen.getAllByRole("button");
		fireEvent.click(first as HTMLElement);
		expect(screen.getByText("1/1 available")).toBeVisible();
		fireEvent.blur(first as HTMLElement);
		expect(screen.queryByText("1/1 available")).toBeNull();
	});
});
