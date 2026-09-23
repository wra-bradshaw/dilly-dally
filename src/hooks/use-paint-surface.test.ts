import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePaintSurface } from "./use-paint-surface";

function pointer() {
	return { pointerId: 1 } as unknown as React.PointerEvent;
}

describe("usePaintSurface escape", () => {
	it("cancels an in-progress paint without committing", () => {
		let committed: Set<string> | null = null;
		const { result } = renderHook(() =>
			usePaintSurface<string, HTMLDivElement>({
				attr: "data-day",
				onCommit: (next) => {
					committed = next;
				},
				parse: (raw) => raw,
				selected: new Set(),
				values: ["a", "b"],
			}),
		);
		act(() => result.current.start("a", pointer()));
		expect(result.current.painting).toBe(true);
		act(() =>
			result.current.onKeyDown({ key: "Escape" } as React.KeyboardEvent),
		);
		expect(result.current.painting).toBe(false);
		expect(committed).toBeNull();
	});

	it("ignores non-escape keys", () => {
		const { result } = renderHook(() =>
			usePaintSurface<string, HTMLDivElement>({
				attr: "data-day",
				onCommit: () => {},
				parse: (raw) => raw,
				selected: new Set(),
				values: ["a", "b"],
			}),
		);
		act(() => result.current.start("a", pointer()));
		act(() =>
			result.current.onKeyDown({ key: "Enter" } as React.KeyboardEvent),
		);
		expect(result.current.painting).toBe(true);
	});
});
