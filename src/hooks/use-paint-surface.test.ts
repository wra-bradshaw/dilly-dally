import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	shouldSuppressToggleKey,
	suppressToggleKey,
	usePaintSurface,
} from "./use-paint-surface";

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

describe("suppressToggleKey", () => {
	function toggleKey(overrides: Record<string, unknown> = {}) {
		return {
			altKey: false,
			ctrlKey: false,
			key: "Enter",
			metaKey: false,
			preventDefault: vi.fn(),
			repeat: false,
			...overrides,
		} as unknown as React.KeyboardEvent & { preventDefault(): void };
	}

	it("suppresses repeat toggle keys and prevents native activation", () => {
		expect(shouldSuppressToggleKey(toggleKey({ repeat: true }))).toBe(true);
		const e = toggleKey({ key: " ", repeat: true });
		expect(suppressToggleKey(e)).toBe(true);
		expect(e.preventDefault).toHaveBeenCalledTimes(1);
	});

	it("suppresses modified toggle keys", () => {
		expect(shouldSuppressToggleKey(toggleKey({ ctrlKey: true }))).toBe(true);
		expect(shouldSuppressToggleKey(toggleKey({ metaKey: true }))).toBe(true);
		expect(shouldSuppressToggleKey(toggleKey({ altKey: true }))).toBe(true);
	});

	it("passes plain activation and unrelated keys through", () => {
		expect(shouldSuppressToggleKey(toggleKey())).toBe(false);
		expect(suppressToggleKey(toggleKey())).toBe(false);
		expect(shouldSuppressToggleKey(toggleKey({ key: "ArrowDown" }))).toBe(
			false,
		);
	});
});
