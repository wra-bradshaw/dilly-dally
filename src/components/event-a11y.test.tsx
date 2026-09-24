import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

type Oklch = [lightness: number, chroma: number, hue: number];

function readToken(css: string, scope: string, token: string): Oklch {
	const block = new RegExp(`${scope}\\s*\\{([^}]*)\\}`, "s").exec(css)?.[1];
	const value = block
		? new RegExp(`${token}:\\s*([^;]+);`).exec(block)?.[1]
		: undefined;
	const parsed = value
		? /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value)
		: undefined;
	expect(parsed, `${token} in ${scope} must be an oklch color`).not.toBeNull();
	return [Number(parsed?.[1]), Number(parsed?.[2]), Number(parsed?.[3])];
}

function oklchToSrgb([lightness, chroma, hue]: Oklch): [
	number,
	number,
	number,
] {
	const radians = (hue * Math.PI) / 180;
	const a = chroma * Math.cos(radians);
	const b = chroma * Math.sin(radians);
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const linear: [number, number, number] = [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
	return linear.map((channel) =>
		channel <= 0.0031308
			? 12.92 * channel
			: 1.055 * channel ** (1 / 2.4) - 0.055,
	) as [number, number, number];
}

function relativeLuminance(color: Oklch): number {
	const [r, g, b] = oklchToSrgb(color).map((channel) =>
		channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(first: Oklch, second: Oklch): number {
	const [lighter, darker] = [first, second]
		.map(relativeLuminance)
		.sort((a, b) => b - a) as [number, number];
	return (lighter + 0.05) / (darker + 0.05);
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

	it("keeps the focus ring at >=3:1 against adjacent surfaces", () => {
		const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
		const lightRing = readToken(css, ":root", "--ring");
		const darkRing = readToken(css, ".dark", "--ring");
		const darkBackground = readToken(css, ".dark", "--background");
		const adjacents: Array<[string, Oklch]> = [
			["white", [1, 0, 0]],
			["rose-100", [0.941, 0.03, 12.58]],
			["emerald-100", [0.95, 0.052, 163.051]],
			["emerald-400", [0.765, 0.177, 163.223]],
		];
		const darkFills: Array<[string, Oklch]> = [
			["emerald-700", [0.508, 0.118, 165.612]],
			["emerald-800", [0.432, 0.095, 166.913]],
			["emerald-900", [0.378, 0.077, 168.94]],
			["emerald-950", [0.262, 0.051, 172.552]],
			["rose-950", [0.271, 0.105, 12.094]],
		];
		for (const [name, adjacent] of adjacents) {
			expect(
				contrastRatio(lightRing, adjacent),
				`light --ring vs ${name}`,
			).toBeGreaterThanOrEqual(3);
		}
		expect(contrastRatio(darkRing, darkBackground)).toBeGreaterThanOrEqual(3);
		for (const [name, fill] of darkFills) {
			expect(
				contrastRatio(darkRing, fill),
				`dark --ring vs ${name}`,
			).toBeGreaterThanOrEqual(3);
		}
		expect(css).toMatch(/forced-colors:\s*active/);
		expect(css).toMatch(/outline:\s*2px solid Highlight/);
	});
});
