import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDragPaint } from "./use-drag-paint";

const values = ["a", "b", "c", "d"];

function setup(selected: string[], mode: "auto" | "add" | "remove" = "auto") {
	const onCommit = vi.fn();
	const hook = renderHook(() =>
		useDragPaint({ mode, onCommit, selected: new Set(selected), values }),
	);
	return { hook, onCommit };
}

describe("useDragPaint", () => {
	it("paints a dragged range in auto mode", () => {
		const { hook, onCommit } = setup([]);
		act(() => hook.result.current.onPointerDown("b"));
		act(() => hook.result.current.onPointerEnter("d"));
		expect([...hook.result.current.preview].sort()).toEqual(["b", "c", "d"]);
		act(() => hook.result.current.onPointerUp());
		expect(onCommit).toHaveBeenCalledOnce();
		expect([...onCommit.mock.calls[0][0]].sort()).toEqual(["b", "c", "d"]);
	});

	it("erases when starting on a selected cell", () => {
		const { hook, onCommit } = setup(["a", "b", "c"]);
		act(() => hook.result.current.onPointerDown("c"));
		act(() => hook.result.current.onPointerEnter("b"));
		expect([...hook.result.current.preview].sort()).toEqual(["a"]);
		act(() => hook.result.current.onPointerUp());
		expect([...onCommit.mock.calls[0][0]].sort()).toEqual(["a"]);
	});

	it("forces add and remove modes", () => {
		const add = setup(["a"], "add");
		act(() => add.hook.result.current.onPointerDown("a"));
		act(() => add.hook.result.current.onPointerEnter("b"));
		expect([...add.hook.result.current.preview].sort()).toEqual(["a", "b"]);

		const remove = setup(["a", "b"], "remove");
		act(() => remove.hook.result.current.onPointerDown("a"));
		act(() => remove.hook.result.current.onPointerEnter("a"));
		expect([...remove.hook.result.current.preview]).toEqual(["b"]);
	});
});
