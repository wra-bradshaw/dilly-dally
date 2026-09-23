import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "#/lib/client";
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
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(detail), {
				headers: { "Content-Type": "application/json" },
				status: 200,
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		try {
			const { result } = renderHook(() => useEventDetail("AbC123_-XyZ9"), {
				wrapper: wrapper(),
			});
			await waitFor(() => expect(result.current.isSuccess).toBe(true));
			expect(result.current.data).toEqual(detail);
			const [req] = fetchMock.mock.calls[0] as unknown as [Request];
			expect(req.url).toContain("/api/events/AbC123_-XyZ9");
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("surfaces a typed not-found error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: { code: "not_found", message: "Event not found" },
					}),
					{
						headers: { "Content-Type": "application/json" },
						status: 404,
					},
				),
			),
		);
		try {
			const { result } = renderHook(() => useEventDetail("nope"), {
				wrapper: wrapper(),
			});
			await waitFor(() => expect(result.current.isError).toBe(true));
			expect(result.current.data).toBeUndefined();
			expect(result.current.error).toBeInstanceOf(HttpError);
			expect(result.current.error).toMatchObject({
				code: "not_found",
				status: 404,
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("surfaces retryable server errors distinctly from missing events", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: { code: "error", message: "Bad gateway" },
					}),
					{
						headers: { "Content-Type": "application/json" },
						status: 502,
					},
				),
			),
		);
		try {
			const { result } = renderHook(() => useEventDetail("AbC123_-XyZ9"), {
				wrapper: wrapper(),
			});
			await waitFor(() => expect(result.current.isError).toBe(true));
			const err = result.current.error as HttpError;
			expect(err.status).toBe(502);
			expect(err.status === 404 || err.status === 410).toBe(false);
			await expect(result.current.refetch()).resolves.toBeDefined();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
