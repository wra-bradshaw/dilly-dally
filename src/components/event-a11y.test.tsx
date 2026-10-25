import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvailabilityGrid } from "./availability-grid";
import { buildColumns } from "./grid-model";
import { GroupHeatmap } from "./group-heatmap";
import { TimeGrid } from "./time-grid";

function cols() {
	return buildColumns(
		[
			"2026-09-28T09:00",
			"2026-09-28T09:30",
			"2026-09-29T09:00",
			"2026-09-29T09:30",
		],
		{ eventTimezone: "UTC", mode: "dates", viewTimezone: "UTC" },
	);
}

function countsFor(columns: ReturnType<typeof buildColumns>) {
	return new Map(
		columns.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
}

describe("TimeGrid table semantics", () => {
	it("names every column header and exposes a caption", () => {
		const { container } = render(
			<TimeGrid
				columns={cols()}
				renderCell={() => <span />}
				tableLabel="Your availability"
			/>,
		);
		const caption = container.querySelector("caption");
		expect(caption?.textContent).toMatch(/Your availability/);
		const emptyHeaders = [...container.querySelectorAll("th")].filter(
			(th) => (th.textContent ?? "").trim() === "",
		);
		expect(emptyHeaders).toHaveLength(0);
	});

	it("links data cells to headers and labels blank gutter cells", () => {
		const { container } = render(
			<TimeGrid
				columns={cols()}
				renderCell={() => <button type="button">x</button>}
				tableLabel="Your availability"
			/>,
		);
		const dataCells = [...container.querySelectorAll("tbody td")].filter(
			(td) =>
				td.querySelector("button") !== null &&
				td.getAttribute("aria-hidden") !== "true",
		);
		expect(dataCells.length).toBeGreaterThan(0);
		for (const td of dataCells) {
			expect(td.hasAttribute("headers")).toBe(true);
		}
		const blankRowHeaders = [
			...container.querySelectorAll('th[scope="row"]'),
		].filter((th) => (th.textContent ?? "").trim() === "");
		expect(blankRowHeaders).toHaveLength(0);
	});

	it("announces the summary through a live region", () => {
		const { container } = render(
			<TimeGrid
				columns={cols()}
				renderCell={() => <span />}
				tableLabel="Your availability"
			/>,
		);
		expect(container.querySelector("output.sr-only")).not.toBeNull();
	});
});

describe("grid cell focus and selection cues", () => {
	it("gives paint cells a visible focus ring and a non-color selected cue", () => {
		const columns = cols();
		const { container } = render(
			<AvailabilityGrid
				columns={columns}
				onCommit={() => {}}
				selected={new Set([columns[0]?.cells[0]?.id ?? ""])}
			/>,
		);
		const pressed = container.querySelector(
			'button[aria-pressed="true"]',
		) as HTMLElement | null;
		expect(pressed).not.toBeNull();
		expect(pressed?.className).toMatch(/focus-visible:ring/);
		expect(pressed?.className).toMatch(/focus-visible:outline/);
		expect(pressed?.textContent).not.toBe("");
	});

	it("describes heatmap cells via a hover-preview panel with list markup", () => {
		const columns = cols();
		render(
			<GroupHeatmap
				allNames={["Ada", "Bo"]}
				columns={columns}
				counts={countsFor(columns)}
				eventTimezone="UTC"
				total={2}
				viewTimezone="UTC"
			/>,
		);
		const [first] = screen.getAllByRole("button");
		expect(first).toHaveAttribute("aria-describedby");
		expect(first).not.toHaveAttribute("aria-expanded");
		expect(first).not.toHaveAttribute("aria-controls");
		const panelId =
			(first as HTMLElement).getAttribute("aria-describedby") ?? "";
		const panel = document.getElementById(panelId);
		expect(panel).not.toBeNull();
		expect(panel?.getAttribute("aria-live")).toBeNull();
		expect(panel?.textContent).toMatch(/Hover or tap/);
	});
});
