import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEventDetail } from "./use-event-detail";

function wrapper() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={client}>{children}</QueryClientProvider>
		);
	};
}

describe("useEventDetail", () => {
	it("fetches event detail by id", async () => {
		const detail = { event: { id: "AbC123_-XyZ9" } };
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue({ json: () => Promise.resolve(detail), ok: true }),
		);
		try {
			const { result } = renderHook(() => useEventDetail("AbC123_-XyZ9"), {
				wrapper: wrapper(),
			});
			await waitFor(() => expect(result.current.isSuccess).toBe(true));
			expect(result.current.data).toEqual(detail);
			expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
				"/api/events/AbC123_-XyZ9",
			);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
