import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTooltipOpen } from "./use-tooltip-open";

describe("useTooltipOpen", () => {
	it("stays closed initially and follows hover", () => {
		const { result } = renderHook(() => useTooltipOpen(false));
		expect(result.current.open).toBe(false);
		act(() => result.current.onOpenChange(true));
		expect(result.current.open).toBe(true);
		act(() => result.current.onOpenChange(false));
		expect(result.current.open).toBe(false);
	});

	it("forces open while the override is true and restores hover state after", () => {
		const { result, rerender } = renderHook(
			({ forced }: { forced: boolean }) => useTooltipOpen(forced),
			{ initialProps: { forced: false } },
		);
		expect(result.current.open).toBe(false);
		rerender({ forced: true });
		expect(result.current.open).toBe(true);
		rerender({ forced: false });
		expect(result.current.open).toBe(false);
	});

	it("keeps hover-open state across a transient force", () => {
		const { result, rerender } = renderHook(
			({ forced }: { forced: boolean }) => useTooltipOpen(forced),
			{ initialProps: { forced: false } },
		);
		act(() => result.current.onOpenChange(true));
		rerender({ forced: true });
		expect(result.current.open).toBe(true);
		rerender({ forced: false });
		expect(result.current.open).toBe(true);
	});
});
