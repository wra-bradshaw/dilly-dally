import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocumentTitle } from "./use-document-title";

describe("useDocumentTitle", () => {
	it("sets the title with the app suffix", () => {
		document.title = "";
		const { unmount } = renderHook(() => useDocumentTitle("Plan a new event"));
		expect(document.title).toBe("Plan a new event | dilly dally");
		unmount();
	});

	it("falls back to the app name when empty", () => {
		document.title = "";
		const { unmount } = renderHook(() => useDocumentTitle(""));
		expect(document.title).toBe("dilly dally");
		unmount();
	});

	it("updates when the title changes", () => {
		document.title = "";
		const { rerender, unmount } = renderHook(
			({ title }: { title: string }) => useDocumentTitle(title),
			{ initialProps: { title: "First" } },
		);
		expect(document.title).toBe("First | dilly dally");
		rerender({ title: "Second" });
		expect(document.title).toBe("Second | dilly dally");
		unmount();
	});
});
