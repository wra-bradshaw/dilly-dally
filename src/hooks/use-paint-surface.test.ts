import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import {
	shouldSuppressToggleKey,
	suppressToggleKey,
	TOUCH_PAINT_DELAY_MS,
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

function touchDown(x: number, y: number) {
	return {
		clientX: x,
		clientY: y,
		pointerId: 7,
		pointerType: "touch",
	} as unknown as React.PointerEvent;
}

function touchUp(x: number, y: number) {
	return {
		clientX: x,
		clientY: y,
		pointerId: 7,
		pointerType: "touch",
	} as unknown as React.PointerEvent;
}

function paintHook(onCommit: (next: Set<string>) => void) {
	return renderHook(() =>
		usePaintSurface<string, HTMLDivElement>({
			attr: "data-day",
			onCommit,
			parse: (raw) => raw,
			selected: new Set(),
			values: ["a", "b"],
		}),
	);
}

describe("usePaintSurface touch", () => {
	beforeEach(() => {
		document.elementFromPoint = (() =>
			null) as unknown as typeof document.elementFromPoint;
	});
	it("commits a single cell on quick touch tap", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = paintHook((next) => {
				committed = next;
			});
			act(() => result.current.start("a", touchDown(10, 20)));
			expect(result.current.painting).toBe(false);
			act(() => result.current.onPointerUp(touchUp(11, 21)));
			expect(committed).toEqual(new Set(["a"]));
			expect(result.current.painting).toBe(false);
			act(() => {
				vi.runOnlyPendingTimers();
			});
			expect(committed).toEqual(new Set(["a"]));
		} finally {
			vi.useRealTimers();
		}
	});

	it("starts painting after holding touch without moving", () => {
		vi.useFakeTimers();
		try {
			const { result } = paintHook(() => {});
			act(() => result.current.start("a", touchDown(10, 20)));
			expect(result.current.painting).toBe(false);
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS);
			});
			expect(result.current.painting).toBe(true);
			act(() => result.current.onPointerUp(touchUp(10, 20)));
			expect(result.current.painting).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("cancels a pending touch when it moves before the hold elapses", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = paintHook((next) => {
				committed = next;
			});
			act(() => result.current.start("a", touchDown(10, 20)));
			act(() =>
				result.current.onPointerMove({
					clientX: 10,
					clientY: 60,
					pointerId: 7,
				} as React.PointerEvent),
			);
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			expect(result.current.painting).toBe(false);
			act(() => result.current.onPointerUp(touchUp(10, 60)));
			expect(committed).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("cancels a pending touch on pointer cancel", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = paintHook((next) => {
				committed = next;
			});
			act(() => result.current.start("a", touchDown(10, 20)));
			act(() => result.current.onPointerCancel({} as React.PointerEvent));
			act(() => {
				vi.advanceTimersByTime(1000);
			});
			expect(result.current.painting).toBe(false);
			act(() => result.current.onPointerUp(touchUp(10, 20)));
			expect(committed).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("blocks scroll with a non-passive touchmove while touch painting", () => {
		vi.useFakeTimers();
		try {
			const { el, hook } = elementHook(() => {});
			const { result } = hook;
			act(() => result.current.start("a", touchDown(10, 20)));
			const pending = new Event("touchmove", { cancelable: true });
			el.dispatchEvent(pending);
			expect(pending.defaultPrevented).toBe(false);
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS);
			});
			expect(result.current.painting).toBe(true);
			const painting = new Event("touchmove", { cancelable: true });
			el.dispatchEvent(painting);
			expect(painting.defaultPrevented).toBe(true);
			act(() => result.current.onPointerUp(touchUp(10, 20)));
			const after = new Event("touchmove", { cancelable: true });
			el.dispatchEvent(after);
			expect(after.defaultPrevented).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});

function mouseDown(x: number, y: number) {
	return {
		clientX: x,
		clientY: y,
		pointerId: 1,
		pointerType: "mouse",
	} as unknown as React.PointerEvent;
}

function touchDownWithId(x: number, y: number, pointerId: number) {
	return {
		clientX: x,
		clientY: y,
		pointerId,
		pointerType: "touch",
	} as unknown as React.PointerEvent;
}

function elementHook(onCommit: (next: Set<string>) => void) {
	const el = document.createElement("table");
	document.body.appendChild(el);
	onTestFinished(() => {
		el.remove();
	});
	const hook = renderHook(() =>
		usePaintSurface<string, HTMLTableElement>({
			attr: "data-day",
			containerRef: { current: el },
			onCommit,
			parse: (raw) => raw,
			selected: new Set(),
			values: ["a", "b"],
		}),
	);
	return { el, hook };
}

describe("usePaintSurface touch guards", () => {
	it("ignores a second finger during a pending hold", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = paintHook((next) => {
				committed = next;
			});
			act(() => result.current.start("a", touchDown(10, 20)));
			act(() => result.current.onPointerMove(touchDownWithId(90, 90, 9)));
			act(() => result.current.onPointerUp(touchDownWithId(90, 90, 9)));
			expect(committed).toBeNull();
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS);
			});
			expect(result.current.painting).toBe(true);
			act(() => result.current.onPointerUp(touchUp(10, 20)));
			expect(committed).toEqual(new Set(["a"]));
		} finally {
			vi.useRealTimers();
		}
	});

	it("ignores mouse input while a touch hold is pending", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = paintHook((next) => {
				committed = next;
			});
			act(() => result.current.start("a", touchDown(10, 20)));
			act(() => result.current.start("b", mouseDown(50, 50)));
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS);
			});
			expect(result.current.painting).toBe(true);
			act(() => result.current.onPointerUp(touchUp(10, 20)));
			expect(committed).toEqual(new Set(["a"]));
		} finally {
			vi.useRealTimers();
		}
	});

	it("cancels the hold on Escape with no later paint", () => {
		vi.useFakeTimers();
		try {
			const { el, hook } = elementHook(() => {});
			act(() => hook.result.current.start("a", touchDown(10, 20)));
			act(() =>
				hook.result.current.onKeyDown({ key: "Escape" } as React.KeyboardEvent),
			);
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS * 2);
			});
			expect(hook.result.current.painting).toBe(false);
			const move = new Event("touchmove", { cancelable: true });
			el.dispatchEvent(move);
			expect(move.defaultPrevented).toBe(false);
			act(() => hook.result.current.onPointerUp(touchUp(10, 20)));
		} finally {
			vi.useRealTimers();
		}
	});

	it("resets an active paint on pointer cancel", () => {
		vi.useFakeTimers();
		try {
			const { el, hook } = elementHook(() => {});
			act(() => hook.result.current.start("a", touchDown(10, 20)));
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS);
			});
			expect(hook.result.current.painting).toBe(true);
			act(() => hook.result.current.onPointerCancel({} as React.PointerEvent));
			expect(hook.result.current.painting).toBe(false);
			act(() => {
				vi.runOnlyPendingTimers();
			});
			const move = new Event("touchmove", { cancelable: true });
			el.dispatchEvent(move);
			expect(move.defaultPrevented).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("detaches the scroll block when a hold becomes a scroll", () => {
		vi.useFakeTimers();
		try {
			const { el, hook } = elementHook(() => {});
			act(() => hook.result.current.start("a", touchDown(10, 20)));
			act(() =>
				hook.result.current.onPointerMove({
					clientX: 10,
					clientY: 60,
					pointerId: 7,
				} as React.PointerEvent),
			);
			const move = new Event("touchmove", { cancelable: true });
			el.dispatchEvent(move);
			expect(move.defaultPrevented).toBe(false);
			act(() => {
				vi.runOnlyPendingTimers();
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("does nothing on touch start while disabled", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = renderHook(() =>
				usePaintSurface<string, HTMLDivElement>({
					attr: "data-day",
					disabled: true,
					onCommit: (next) => {
						committed = next;
					},
					parse: (raw) => raw,
					selected: new Set(),
					values: ["a", "b"],
				}),
			);
			act(() => result.current.start("a", touchDown(10, 20)));
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS * 2);
			});
			expect(result.current.painting).toBe(false);
			act(() => result.current.onPointerUp(touchUp(10, 20)));
			expect(committed).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("usePaintSurface pointer isolation", () => {
	beforeEach(() => {
		document.elementFromPoint = (() =>
			null) as unknown as typeof document.elementFromPoint;
	});
	it("ignores hover from a foreign pointer while painting", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = paintHook((next) => {
				committed = next;
			});
			act(() => result.current.start("a", touchDown(10, 20)));
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS);
			});
			expect(result.current.painting).toBe(true);
			act(() => result.current.hover("b", touchDownWithId(90, 90, 9)));
			expect(result.current.preview).toEqual(new Set(["a"]));
			act(() => result.current.hover("b", touchUp(10, 20)));
			expect(result.current.preview).toEqual(new Set(["a", "b"]));
			act(() => result.current.onPointerUp(touchUp(10, 20)));
			expect(committed).toEqual(new Set(["a", "b"]));
		} finally {
			vi.useRealTimers();
		}
	});

	it("ignores cancel from a foreign pointer", () => {
		vi.useFakeTimers();
		try {
			const { result } = paintHook(() => {});
			act(() => result.current.start("a", touchDown(10, 20)));
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS);
			});
			expect(result.current.painting).toBe(true);
			act(() => result.current.onPointerCancel(touchDownWithId(90, 90, 9)));
			expect(result.current.painting).toBe(true);
			act(() => result.current.onPointerCancel(touchUp(10, 20)));
			expect(result.current.painting).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("ignores a touch start during an active mouse paint", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result } = paintHook((next) => {
				committed = next;
			});
			act(() => result.current.start("a", mouseDown(10, 20)));
			expect(result.current.painting).toBe(true);
			act(() => result.current.start("b", touchDown(90, 90)));
			act(() => {
				vi.advanceTimersByTime(TOUCH_PAINT_DELAY_MS * 2);
			});
			act(() => result.current.onPointerUp(touchUp(90, 90)));
			expect(committed).toBeNull();
			act(() => result.current.onPointerUp(mouseDown(10, 20)));
			expect(committed).toEqual(new Set(["a"]));
		} finally {
			vi.useRealTimers();
		}
	});

	it("cancels the stroke when disabled mid-gesture", () => {
		vi.useFakeTimers();
		try {
			let committed: Set<string> | null = null;
			const { result, rerender } = renderHook(
				({ disabled }: { disabled: boolean }) =>
					usePaintSurface<string, HTMLDivElement>({
						attr: "data-day",
						disabled,
						onCommit: (next) => {
							committed = next;
						},
						parse: (raw) => raw,
						selected: new Set(),
						values: ["a", "b"],
					}),
				{ initialProps: { disabled: false } },
			);
			act(() => result.current.start("a", mouseDown(10, 20)));
			expect(result.current.painting).toBe(true);
			rerender({ disabled: true });
			act(() => result.current.onPointerUp(mouseDown(10, 20)));
			expect(result.current.painting).toBe(false);
			expect(committed).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("paints without touching the page when pageScroll is off", () => {
		vi.useFakeTimers();
		try {
			const scrollBy = vi.fn();
			Object.defineProperty(window, "scrollBy", {
				configurable: true,
				value: scrollBy,
			});
			const { result } = renderHook(() =>
				usePaintSurface<string, HTMLDivElement>({
					attr: "data-day",
					onCommit: () => {},
					pageScroll: false,
					parse: (raw) => raw,
					selected: new Set(),
					values: ["a", "b"],
				}),
			);
			act(() => result.current.start("a", mouseDown(10, 20)));
			expect(result.current.painting).toBe(true);
			act(() =>
				result.current.onPointerMove({
					clientX: 5,
					clientY: 5,
					pointerId: 1,
					pointerType: "mouse",
				} as React.PointerEvent),
			);
			expect(result.current.painting).toBe(true);
			expect(scrollBy).not.toHaveBeenCalled();
			act(() => result.current.onPointerUp(mouseDown(10, 20)));
		} finally {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		}
	});
});
