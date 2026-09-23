import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSerialSaver } from "./use-serial-saver";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, reject, resolve };
}

describe("useSerialSaver", () => {
	it("runs one save at a time and coalesces trailing submits", async () => {
		const first = deferred<void>();
		const second = deferred<void>();
		const save = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const onSuccess = vi.fn();
		const { result } = renderHook(() => useSerialSaver({ onSuccess, save }));
		act(() => {
			result.current.submit("a");
		});
		expect(save).toHaveBeenCalledTimes(1);
		expect(result.current.inFlight).toBe(true);
		act(() => {
			result.current.submit("b");
			result.current.submit("c");
		});
		expect(save).toHaveBeenCalledTimes(1);
		await act(async () => {
			first.resolve();
		});
		expect(save).toHaveBeenCalledTimes(2);
		expect(save).toHaveBeenLastCalledWith("c");
		await act(async () => {
			second.resolve();
		});
		expect(result.current.inFlight).toBe(false);
		expect(onSuccess).toHaveBeenCalledTimes(2);
	});

	it("reports errors per attempt and still runs the trailing save", async () => {
		const first = deferred<void>();
		const second = deferred<void>();
		const save = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const onError = vi.fn();
		const onSuccess = vi.fn();
		const { result } = renderHook(() =>
			useSerialSaver({ onError, onSuccess, save }),
		);
		act(() => {
			result.current.submit("a");
		});
		act(() => {
			result.current.submit("b");
		});
		await act(async () => {
			first.reject(new Error("offline"));
		});
		expect(onError).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledTimes(2);
		await act(async () => {
			second.resolve();
		});
		expect(onSuccess).toHaveBeenCalledWith("b");
		expect(result.current.inFlight).toBe(false);
	});

	it("never mistakes a throwing callback for a save failure", async () => {
		const first = deferred<void>();
		const save = vi.fn().mockReturnValueOnce(first.promise);
		const onError = vi.fn();
		const onSuccess = vi.fn().mockImplementationOnce(() => {
			throw new Error("consumer bug");
		});
		const { result } = renderHook(() =>
			useSerialSaver({ onError, onSuccess, save }),
		);
		act(() => {
			result.current.submit("a");
		});
		await act(async () => {
			first.resolve();
		});
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
		expect(result.current.inFlight).toBe(false);
		const second = deferred<void>();
		save.mockReturnValueOnce(second.promise);
		act(() => {
			result.current.submit("b");
		});
		expect(save).toHaveBeenCalledTimes(2);
		await act(async () => {
			second.resolve();
		});
		expect(result.current.inFlight).toBe(false);
	});

	it("reports trailing-save failures and releases the queue", async () => {
		const first = deferred<void>();
		const second = deferred<void>();
		const save = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const onError = vi.fn();
		const { result } = renderHook(() => useSerialSaver({ onError, save }));
		act(() => {
			result.current.submit("a");
		});
		act(() => {
			result.current.submit("b");
		});
		await act(async () => {
			first.resolve();
		});
		expect(save).toHaveBeenCalledTimes(2);
		await act(async () => {
			second.reject(new Error("offline"));
		});
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0]?.[1]).toBe("b");
		expect(result.current.inFlight).toBe(false);
	});

	it("drops pending and ignores in-flight callbacks after cancel", async () => {
		const first = deferred<void>();
		const save = vi.fn().mockReturnValueOnce(first.promise);
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const { result } = renderHook(() =>
			useSerialSaver({ onError, onSuccess, save }),
		);
		act(() => {
			result.current.submit("a");
		});
		act(() => {
			result.current.submit("b");
		});
		act(() => {
			result.current.cancel();
		});
		expect(result.current.inFlight).toBe(true);
		await act(async () => {
			first.resolve();
		});
		expect(save).toHaveBeenCalledTimes(1);
		expect(onSuccess).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
		expect(result.current.inFlight).toBe(false);
	});

	it("serializes a resubmit after cancel without concurrent runs", async () => {
		const first = deferred<void>();
		const second = deferred<void>();
		const save = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const onSuccess = vi.fn();
		const onError = vi.fn();
		const { result } = renderHook(() =>
			useSerialSaver({ onError, onSuccess, save }),
		);
		act(() => {
			result.current.submit("a");
		});
		act(() => {
			result.current.submit("b");
		});
		act(() => {
			result.current.cancel();
		});
		act(() => {
			result.current.submit("c");
		});
		expect(save).toHaveBeenCalledTimes(1);
		await act(async () => {
			first.resolve();
		});
		expect(save).toHaveBeenCalledTimes(2);
		expect(save).toHaveBeenLastCalledWith("c");
		await act(async () => {
			second.resolve();
		});
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(onSuccess).toHaveBeenCalledWith("c");
		expect(onError).not.toHaveBeenCalled();
		expect(result.current.inFlight).toBe(false);
	});
});
