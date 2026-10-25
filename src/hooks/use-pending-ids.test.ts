import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePendingIds } from "./use-pending-ids";

describe("usePendingIds", () => {
	it("flips instantly while saving", () => {
		const { result } = renderHook(() => usePendingIds<string[]>());
		expect(result.current.pendingIds).toBeNull();
		let version = 0;
		act(() => {
			version = result.current.commit(["o1"]);
		});
		expect(version).toBe(1);
		expect(result.current.pendingIds).toEqual(["o1"]);
	});

	it("keeps latest toggle when stale settle arrives first", () => {
		const { result } = renderHook(() => usePendingIds<string[]>());
		let first = 0;
		let second = 0;
		act(() => {
			first = result.current.commit(["o1"]);
		});
		act(() => {
			second = result.current.commit(["o1", "o2"]);
		});
		expect(result.current.pendingIds).toEqual(["o1", "o2"]);
		act(() => {
			result.current.resolve(first);
		});
		expect(result.current.pendingIds).toEqual(["o1", "o2"]);
		act(() => {
			result.current.resolve(second);
		});
		expect(result.current.pendingIds).toBeNull();
	});

	it("recovers to server state after latest error settles", () => {
		const { result } = renderHook(() => usePendingIds<string[]>());
		let first = 0;
		let second = 0;
		act(() => {
			first = result.current.commit(["o1"]);
		});
		act(() => {
			second = result.current.commit([]);
		});
		act(() => {
			result.current.resolve(first);
		});
		expect(result.current.pendingIds).toEqual([]);
		act(() => {
			result.current.resolve(second);
		});
		expect(result.current.pendingIds).toBeNull();
	});
});
