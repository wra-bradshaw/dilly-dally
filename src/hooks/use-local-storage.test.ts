import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLocalStorage } from "./use-local-storage";

describe("useLocalStorage", () => {
	it("returns the initial value when empty", () => {
		localStorage.clear();
		const { result } = renderHook(() => useLocalStorage("dd:test", "hi"));
		expect(result.current[0]).toBe("hi");
	});

	it("persists across hook instances", () => {
		localStorage.clear();
		const { result } = renderHook(() => useLocalStorage("dd:test", ""));
		act(() => result.current[1]("Alice"));
		expect(result.current[0]).toBe("Alice");
		const second = renderHook(() => useLocalStorage("dd:test", ""));
		expect(second.result.current[0]).toBe("Alice");
	});
});
