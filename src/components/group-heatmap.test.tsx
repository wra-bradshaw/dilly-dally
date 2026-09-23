import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { heatmapAnnounce } from "#/lib/event-messages";
import { AvailabilityGrid } from "./availability-grid";
import { buildColumns } from "./grid-model";
import {
	GroupHeatmap,
	HEATMAP_CARD_RGB,
	HEATMAP_FILL_RGB,
	HEATMAP_TEXT_RGB,
	heatmapAlpha,
} from "./group-heatmap";

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

describe("GroupHeatmap contrast", () => {
	it("caps cell alpha at 0.6 so dark count text keeps contrast", () => {
		expect(heatmapAlpha(1, 1)).toBeCloseTo(0.6, 5);
		expect(heatmapAlpha(99, 1)).toBeCloseTo(0.6, 5);
		expect(heatmapAlpha(1, 2)).toBeCloseTo(0.525, 5);
		expect(heatmapAlpha(0, 4)).toBeCloseTo(0.15, 5);
	});

	it("keeps emerald-950 count text contrast at max density", () => {
		render(ui());
		const filled = screen
			.getAllByRole("button")
			.map((b) => b as HTMLElement)
			.find((b) => b.style.backgroundColor !== "");
		expect(filled?.style.backgroundColor ?? "").not.toBe("");
		expect(filled?.style.color ?? "").not.toBe("");
		const bg = filled?.style.backgroundColor ?? "";
		const fg = filled?.style.color ?? "";
		const rgba = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(bg);
		const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(fg);
		expect(rgba?.slice(1, 4).map(Number)).toEqual([...HEATMAP_FILL_RGB]);
		expect(Number(rgba?.[4])).toBeCloseTo(heatmapAlpha(1, 1), 5);
		expect(rgb?.slice(1, 4).map(Number)).toEqual([...HEATMAP_TEXT_RGB]);
		const channel = (c: number) => {
			const s = c / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		};
		const luminance = (rgb: [number, number, number]) =>
			0.2126 * channel(rgb[0]) +
			0.7152 * channel(rgb[1]) +
			0.0722 * channel(rgb[2]);
		const alpha = Number(rgba?.[4]);
		const fill: [number, number, number] = [
			Number(rgba?.[1]),
			Number(rgba?.[2]),
			Number(rgba?.[3]),
		];
		const card: [number, number, number] = [...HEATMAP_CARD_RGB];
		const blended = fill.map(
			(c, i) => alpha * c + (1 - alpha) * (card[i] as number),
		) as [number, number, number];
		const text: [number, number, number] = [
			Number(rgb?.[1]),
			Number(rgb?.[2]),
			Number(rgb?.[3]),
		];
		const l1 = luminance(blended);
		const l2 = luminance(text);
		const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
		const shell: [number, number, number] = [249, 252, 250];
		const shellBlended = fill.map(
			(c, i) => alpha * c + (1 - alpha) * (shell[i] as number),
		) as [number, number, number];
		const s1 = luminance(shellBlended);
		const shellRatio = (Math.max(s1, l2) + 0.05) / (Math.min(s1, l2) + 0.05);
		expect(shellRatio).toBeGreaterThanOrEqual(4.5);
	});

	it("leaves zero-count cells unfilled", () => {
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
		expect((second as HTMLElement).style.backgroundColor).not.toBe("");
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
