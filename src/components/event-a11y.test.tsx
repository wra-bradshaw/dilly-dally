import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvailabilityGrid } from "./availability-grid";
import { buildColumns } from "./grid-model";
import { GroupHeatmap } from "./group-heatmap";
import { TimeGrid } from "./time-grid";
import { buttonVariants } from "./ui/button";
import { toggleVariants } from "./ui/toggle";

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

	it("exposes heatmap cells as disclosures linked to a list-based detail panel", () => {
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
		expect(first).toHaveAttribute("aria-expanded");
		expect(first).toHaveAttribute("aria-controls");
		const panelId = (first as HTMLElement).getAttribute("aria-controls") ?? "";
		expect(document.getElementById(panelId)).not.toBeNull();
	});
});

describe("control focus rings", () => {
	it("gives buttons a solid high-contrast focus ring with forced-colors fallback", () => {
		const classes = buttonVariants({ variant: "default", size: "default" });
		expect(classes).toMatch(/focus-visible:ring-2/);
		expect(classes).toMatch(/forced-colors/);
		expect(classes).toMatch(/motion-reduce/);
	});

	it("gives toggles a solid high-contrast focus ring", () => {
		const classes = toggleVariants({ variant: "default", size: "default" });
		expect(classes).toMatch(/focus-visible:ring-ring/);
		expect(classes).not.toMatch(/ring-ring\/50/);
		expect(classes).toMatch(/forced-colors/);
	});
});
