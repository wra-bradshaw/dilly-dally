import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

describe("useCopyToClipboard", () => {
	it("copies text and flips back after reset", async () => {
		vi.useFakeTimers();
		try {
			const writeText = vi.fn().mockResolvedValue(undefined);
			Object.assign(navigator, { clipboard: { writeText } });
			const { result } = renderHook(() => useCopyToClipboard(1000));
			expect(result.current.copied).toBe(false);
			await act(async () => {
				await result.current.copy("https://x.test/e/abc");
			});
			expect(writeText).toHaveBeenCalledWith("https://x.test/e/abc");
			expect(result.current.copied).toBe(true);
			act(() => vi.advanceTimersByTime(1000));
			expect(result.current.copied).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});
});
