import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGroupLabelling } from "./use-group-labelling";

describe("useGroupLabelling", () => {
	it("prefixes stable ids for label and hint", () => {
		const { result } = renderHook(() => useGroupLabelling("dates"));
		expect(result.current.labelId).toContain("dates");
		expect(result.current.hintId).toContain("dates");
		expect(result.current.labelId).not.toBe(result.current.hintId);
		const first = result.current.labelId;
		expect(result.current.labelId).toBe(first);
	});

	it("generates unique ids per instance", () => {
		const { result: a } = renderHook(() => useGroupLabelling("dates"));
		const { result: b } = renderHook(() => useGroupLabelling("dates"));
		expect(a.current.labelId).not.toBe(b.current.labelId);
	});

	it("builds group props pointing at the visible label", () => {
		const { result } = renderHook(() => useGroupLabelling("times"));
		const props = result.current.groupProps();
		expect(props["aria-labelledby"]).toBe(result.current.labelId);
		expect(props["aria-describedby"]).toBe(result.current.hintId);
	});
});
