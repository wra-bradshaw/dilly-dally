import { describe, expect, it } from "vitest";
import {
	edgeScrollDelta,
	nearestOverflowAncestor,
	PAINT_EDGE_PX,
	paintTargetFromPoint,
} from "./paint-target";

describe("edgeScrollDelta", () => {
	it("returns 0 when nothing overflows", () => {
		expect(edgeScrollDelta(5, 0, 100, 0, 100, 100)).toBe(0);
	});

	it("returns 0 in the middle", () => {
		expect(edgeScrollDelta(50, 0, 100, 40, 200, 100)).toBe(0);
	});

	it("scrolls back near the start when there is room", () => {
		expect(edgeScrollDelta(2, 0, 100, 40, 200, 100)).toBeLessThan(0);
	});

	it("stays put near the start when already at the beginning", () => {
		expect(edgeScrollDelta(2, 0, 100, 0, 200, 100)).toBe(0);
	});

	it("scrolls forward near the end when there is room", () => {
		expect(edgeScrollDelta(98, 0, 100, 40, 200, 100)).toBeGreaterThan(0);
	});

	it("stays put near the end when already at the limit", () => {
		expect(edgeScrollDelta(98, 0, 100, 100, 200, 100)).toBe(0);
	});

	it("scrolls faster closer to the edge", () => {
		const near = Math.abs(edgeScrollDelta(1, 0, 100, 40, 200, 100));
		const far = Math.abs(
			edgeScrollDelta(PAINT_EDGE_PX - 1, 0, 100, 40, 200, 100),
		);
		expect(near).toBeGreaterThan(far);
	});
});

describe("nearestOverflowAncestor", () => {
	function sized(
		tag: string,
		scroll: number,
		client: number,
		ox = "auto",
		oy = "auto",
	) {
		const el = document.createElement(tag);
		el.style.overflowX = ox;
		el.style.overflowY = oy;
		for (const prop of [
			"scrollWidth",
			"clientWidth",
			"scrollHeight",
			"clientHeight",
		] as const) {
			Object.defineProperty(el, prop, { configurable: true, value: scroll });
		}
		Object.defineProperty(el, "clientWidth", {
			configurable: true,
			value: client,
		});
		Object.defineProperty(el, "clientHeight", {
			configurable: true,
			value: client,
		});
		return el;
	}

	it("returns null when nothing overflows", () => {
		const leaf = sized("td", 0, 0);
		sized("div", 0, 0).appendChild(leaf);
		expect(nearestOverflowAncestor(leaf)).toBeNull();
		expect(nearestOverflowAncestor(null)).toBeNull();
	});

	it("returns the nearest horizontal overflow ancestor", () => {
		const outer = sized("div", 300, 100);
		const inner = sized("div", 300, 100);
		const leaf = sized("table", 50, 50);
		outer.appendChild(inner);
		inner.appendChild(leaf);
		expect(nearestOverflowAncestor(leaf)).toBe(inner);
	});

	it("finds vertical overflow on the y axis only", () => {
		const outer = sized("div", 100, 100);
		Object.defineProperty(outer, "scrollHeight", {
			configurable: true,
			value: 400,
		});
		const leaf = sized("table", 50, 50);
		outer.appendChild(leaf);
		expect(nearestOverflowAncestor(leaf, "x")).toBeNull();
		expect(nearestOverflowAncestor(leaf, "y")).toBe(outer);
	});

	it("ignores ancestors that cannot scroll", () => {
		const outer = sized("div", 300, 100, "visible", "visible");
		const leaf = sized("table", 50, 50);
		outer.appendChild(leaf);
		expect(nearestOverflowAncestor(leaf)).toBeNull();
		expect(nearestOverflowAncestor(leaf, "y")).toBeNull();
	});
});

describe("paintTargetFromPoint", () => {
	it("resolves the cell under a point", () => {
		const btn = document.createElement("button");
		btn.setAttribute("data-cell", "a");
		document.elementFromPoint = (() =>
			btn) as unknown as typeof document.elementFromPoint;
		expect(paintTargetFromPoint(10, 20, "data-cell")).toBe("a");
	});

	it("returns null with no element or no match", () => {
		document.elementFromPoint = (() =>
			null) as unknown as typeof document.elementFromPoint;
		expect(paintTargetFromPoint(10, 20, "data-cell")).toBeNull();
		const plain = document.createElement("div");
		document.elementFromPoint = (() =>
			plain) as unknown as typeof document.elementFromPoint;
		expect(paintTargetFromPoint(10, 20, "data-cell")).toBeNull();
	});
});
