import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDragPaint } from "./use-drag-paint";

const values = ["a", "b", "c", "d"];

function setup(selected: string[]) {
	const onCommit = vi.fn();
	const hook = renderHook(() =>
		useDragPaint({ onCommit, selected: new Set(selected), values }),
	);
	return { hook, onCommit };
}

describe("useDragPaint", () => {
	it("paints a dragged range", () => {
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

	it("uses a custom range function when provided", () => {
		const onCommit = vi.fn();
		const hook = renderHook(() =>
			useDragPaint({
				onCommit,
				range: (_values, from, to) => [from, to],
				selected: new Set<string>(),
				values,
			}),
		);
		act(() => hook.result.current.onPointerDown("a"));
		act(() => hook.result.current.onPointerEnter("d"));
		expect([...hook.result.current.preview].sort()).toEqual(["a", "d"]);
		act(() => hook.result.current.onPointerUp());
		expect([...onCommit.mock.calls[0][0]].sort()).toEqual(["a", "d"]);
	});

	it("commits the final value passed to pointer up", () => {
		const { hook, onCommit } = setup([]);
		act(() => hook.result.current.onPointerDown("a"));
		act(() => hook.result.current.onPointerUp("d"));
		expect([...onCommit.mock.calls[0][0]].sort()).toEqual(["a", "b", "c", "d"]);
	});

	it("discards the drag on cancel without committing", () => {
		const { hook, onCommit } = setup([]);
		act(() => hook.result.current.onPointerDown("a"));
		act(() => hook.result.current.onPointerEnter("c"));
		act(() => hook.result.current.onPointerCancel());
		expect(onCommit).not.toHaveBeenCalled();
		expect(hook.result.current.painting).toBe(false);
		expect([...hook.result.current.preview]).toEqual([]);
	});
});
