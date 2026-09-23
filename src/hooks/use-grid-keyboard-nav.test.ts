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
		altKey: false,
		ctrlKey: false,
		key: keyName,
		metaKey: false,
		preventDefault: () => {},
		shiftKey: false,
		target: null,
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

	it("clamps ArrowRight at the last column", () => {
		const { hook } = setup();
		act(() =>
			hook.result.current.onGridKeyDown({
				...key("ArrowRight"),
				target: { dataset: { cell: "b0" } },
			} as unknown as React.KeyboardEvent),
		);
		expect(hook.result.current.roving).toBe("b0");
	});

	it("clamps ArrowDown at the last row", () => {
		const { hook } = setup();
		act(() =>
			hook.result.current.onGridKeyDown({
				...key("ArrowDown"),
				target: { dataset: { cell: "a1" } },
			} as unknown as React.KeyboardEvent),
		);
		expect(hook.result.current.roving).toBe("a1");
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

	it("moves DOM focus to the first cell when the event target is stale", () => {
		const focus = vi.fn();
		const tableRef = {
			current: {
				querySelector: () => ({ focus }),
			} as unknown as HTMLTableElement,
		};
		const single = [columns[0] as (typeof columns)[number]];
		const hook = renderHook(() =>
			useGridKeyboardNav(single, buildGridPos(single), tableRef),
		);
		act(() =>
			hook.result.current.onGridKeyDown({
				key: "ArrowRight",
				preventDefault: () => {},
				target: { dataset: { cell: "gone" } },
			} as unknown as React.KeyboardEvent),
		);
		expect(focus).toHaveBeenCalledTimes(1);
		expect(hook.result.current.roving).toBe("a0");
	});

	it("ignores keys when the grid is empty", () => {
		const tableRef = {
			current: null,
		} as unknown as React.RefObject<HTMLTableElement | null>;
		const hook = renderHook(() =>
			useGridKeyboardNav([], buildGridPos([]), tableRef),
		);
		expect(hook.result.current.roving).toBeNull();
		act(() => hook.result.current.onGridKeyDown(key("ArrowRight")));
		expect(hook.result.current.roving).toBeNull();
	});

	it("reads the cell id from the event target", () => {
		const { hook } = setup();
		act(() =>
			hook.result.current.onGridKeyDown({
				key: "ArrowDown",
				preventDefault: () => {},
				target: { dataset: { cell: "b0" } },
			} as unknown as React.KeyboardEvent),
		);
		expect(hook.result.current.roving).toBe("b1");
	});
});
