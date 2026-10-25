import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AvailabilityResponse } from "#/lib/client";
import { HttpError } from "#/lib/http-error";
import { useEventSave } from "./use-event-save";

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

function setup(overrides: Partial<Parameters<typeof useEventSave>[0]> = {}) {
	const setSelected = vi.fn();
	const lastSavedRef = { current: new Set<string>(["keep"]) };
	const saveFn = vi.fn().mockResolvedValue(undefined);
	const initial: Parameters<typeof useEventSave>[0] = {
		activeName: "Ada",
		eventId: "ev1",
		lastSavedRef,
		password: "",
		saveFn,
		setSelected,
		signedIn: true,
		...overrides,
	};
	const { result, rerender } = renderHook(
		(props: Parameters<typeof useEventSave>[0]) => useEventSave(props),
		{ initialProps: initial, wrapper: wrapper() },
	);
	return { lastSavedRef, rerender, result, saveFn, setSelected };
}

describe("useEventSave", () => {
	it("updates selection but skips submit while signed out", () => {
		const { result, saveFn, setSelected } = setup({ signedIn: false });
		act(() => {
			result.current.commit(new Set(["a"]));
		});
		expect(setSelected).toHaveBeenCalledWith(new Set(["a"]));
		expect(saveFn).not.toHaveBeenCalled();
		expect(result.current.saveState).toBe("");
	});

	it("updates selection but skips submit without an identity", () => {
		const { result, saveFn, setSelected } = setup({ activeName: "" });
		act(() => {
			result.current.commit(new Set(["a"]));
		});
		expect(setSelected).toHaveBeenCalledWith(new Set(["a"]));
		expect(saveFn).not.toHaveBeenCalled();
	});

	it("saves with undefined password for empty input and marks Saved", async () => {
		const { lastSubmittedRef, result, saveFn } = setup({
			activeName: "Ada",
			password: "",
		}) as unknown as {
			lastSubmittedRef: { current: unknown };
			result: { current: ReturnType<typeof useEventSave> };
			saveFn: ReturnType<typeof vi.fn>;
		};
		const next = new Set(["a", "b"]);
		act(() => {
			result.current.commit(next);
		});
		expect(result.current.saveState).toBe("Saving…");
		expect(saveFn).toHaveBeenCalledTimes(1);
		expect(saveFn.mock.calls[0]?.[1]).toEqual({
			name: "Ada",
			password: undefined,
			slots: ["a", "b"],
		});
		await act(async () => {
			await Promise.resolve();
		});
		expect(result.current.saveState).toBe("Saved");
		expect(result.current.saveFailed).toBe(false);
		expect(lastSubmittedRef ?? null).toBeDefined();
	});

	it("forwards a non-empty password to the save call", async () => {
		const { result, saveFn } = setup({ password: "secret" });
		act(() => {
			result.current.commit(new Set(["a"]));
		});
		expect(saveFn.mock.calls[0]?.[1]).toMatchObject({ password: "secret" });
		await act(async () => {
			await Promise.resolve();
		});
		expect(result.current.saveState).toBe("Saved");
	});

	it("reverts to the last saved set and flags the failure", async () => {
		const { lastSavedRef, result, saveFn, setSelected } = setup({});
		lastSavedRef.current = new Set(["keep"]);
		saveFn.mockRejectedValueOnce(
			new HttpError(403, "invalid_password", "nope"),
		);
		act(() => {
			result.current.commit(new Set(["changed"]));
		});
		await act(async () => {
			await Promise.resolve();
		});
		expect(setSelected).toHaveBeenCalledWith(new Set(["keep"]));
		expect(result.current.saveFailed).toBe(true);
		expect(result.current.saveState).toBe(
			"Wrong password for this name. Change reverted.",
		);
	});

	it("ignores stale callbacks once a newer commit has superseded them", async () => {
		const releases: Array<() => void> = [];
		const saveFn = vi.fn(
			(): Promise<AvailabilityResponse> =>
				new Promise<AvailabilityResponse>((resolve) => {
					releases.push(() =>
						resolve({
							count: 1,
							name: "Ada",
							protected: false,
							updatedAt: "2026-01-01T00:00:00.000Z",
						}),
					);
				}),
		);
		const { lastSavedRef, result, setSelected } = setup({ saveFn });
		const first = new Set(["first"]);
		const second = new Set(["second"]);
		act(() => {
			result.current.commit(first);
		});
		act(() => {
			result.current.commit(second);
		});
		expect(saveFn).toHaveBeenCalledTimes(1);
		setSelected.mockClear();
		await act(async () => {
			releases[0]?.();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(saveFn).toHaveBeenCalledTimes(2);
		expect(lastSavedRef.current).toEqual(first);
		expect(setSelected).not.toHaveBeenCalled();
		await act(async () => {
			releases[1]?.();
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(lastSavedRef.current).toEqual(second);
		expect(setSelected).toHaveBeenCalledTimes(1);
		expect(setSelected).toHaveBeenCalledWith(second);
		expect(result.current.saveState).toBe("Saved");
	});

	it("clears pending state on reset without touching selection", () => {
		const { result, saveFn, setSelected } = setup({});
		act(() => {
			result.current.commit(new Set(["a"]));
		});
		act(() => {
			result.current.resetSave();
		});
		expect(result.current.saveState).toBe("");
		expect(result.current.saveFailed).toBe(false);
		expect(saveFn).toHaveBeenCalledTimes(1);
		expect(setSelected).toHaveBeenCalledTimes(1);
	});
});
