import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildGridPos, type GridColumn } from "#/components/grid-model";
import { useGridKeyboardNav } from "./use-grid-keyboard-nav";

const columns: GridColumn[] = [
	{
		cells: [
			{ display: "a0", hourStart: true, id: "a0", label: "a0" },
			{ display: "a1", hourStart: false, id: "a1", label: "a1" },
		],
		header: "A",
		key: "a",
	},
	{
		cells: [
			{ display: "b0", hourStart: true, id: "b0", label: "b0" },
			{ display: "b1", hourStart: false, id: "b1", label: "b1" },
		],
		header: "B",
		key: "b",
	},
];

function setup() {
	const focus = vi.fn();
	const tableRef = {
		current: {
			querySelector: () => ({ focus }),
		} as unknown as HTMLTableElement,
	};
	const pos = buildGridPos(columns);
	const hook = renderHook(() => useGridKeyboardNav(columns, pos, tableRef));
	return { focus, hook };
}

function key(keyName: string) {
	return {
		key: keyName,
		preventDefault: () => {},
	} as unknown as React.KeyboardEvent;
}

describe("useGridKeyboardNav boundaries", () => {
	it("clamps ArrowLeft at the first column", () => {
		const { hook } = setup();
		act(() => hook.result.current.onGridKeyDown(key("ArrowLeft")));
		expect(hook.result.current.roving).toBe("a0");
	});

	it("clamps ArrowUp at the first row", () => {
		const { hook } = setup();
		act(() => hook.result.current.onGridKeyDown(key("ArrowUp")));
		expect(hook.result.current.roving).toBe("a0");
	});

	it("moves within bounds", () => {
		const { hook } = setup();
		act(() => hook.result.current.onGridKeyDown(key("ArrowRight")));
		expect(hook.result.current.roving).toBe("b0");
		act(() => hook.result.current.onGridKeyDown(key("ArrowDown")));
		expect(hook.result.current.roving).toBe("b1");
	});

	it("jumps to row edges with Home and End", () => {
		const { hook } = setup();
		act(() => hook.result.current.onGridKeyDown(key("ArrowRight")));
		act(() => hook.result.current.onGridKeyDown(key("ArrowDown")));
		expect(hook.result.current.roving).toBe("b1");
		act(() => hook.result.current.onGridKeyDown(key("Home")));
		expect(hook.result.current.roving).toBe("a1");
		act(() => hook.result.current.onGridKeyDown(key("End")));
		expect(hook.result.current.roving).toBe("b1");
	});

	it("falls back to the first id when the focused cell is gone", () => {
		const focus = vi.fn();
		const tableRef = {
			current: {
				querySelector: () => ({ focus }),
			} as unknown as HTMLTableElement,
		};
		const hook = renderHook(
			({ cols }: { cols: typeof columns }) =>
				useGridKeyboardNav(cols, buildGridPos(cols), tableRef),
			{ initialProps: { cols: columns } },
		);
		act(() => hook.result.current.onGridKeyDown(key("ArrowRight")));
		expect(hook.result.current.roving).toBe("b0");
		hook.rerender({ cols: [columns[0] as (typeof columns)[number]] });
		expect(hook.result.current.roving).toBe("a0");
	});
});
