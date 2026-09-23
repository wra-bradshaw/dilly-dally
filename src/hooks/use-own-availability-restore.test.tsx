import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "#/lib/client";
import { useOwnAvailabilityRestore } from "./use-own-availability-restore";

const eventId = "AbC123_-XyZ9";

function setup(options: {
	storedName: string;
	eventSettled?: boolean;
	fetchAvailability: (
		eventId: string,
		name: string,
	) => Promise<{
		name: string;
		slots: string[];
	}>;
}) {
	const onRestored = vi.fn();
	const onNeedsPassword = vi.fn();
	const onCleared = vi.fn();
	const onGone = vi.fn();
	const hook = renderHook(
		({ storedName }) =>
			useOwnAvailabilityRestore({
				eventId,
				eventSettled: options.eventSettled,
				fetchAvailability: options.fetchAvailability as never,
				onCleared: () => onCleared(),
				onGone: () => onGone(),
				onNeedsPassword: (name) => onNeedsPassword(name),
				onRestored: (own) => onRestored(own),
				storedName,
			}),
		{ initialProps: { storedName: options.storedName } },
	);
	return { hook, onCleared, onGone, onNeedsPassword, onRestored };
}

describe("useOwnAvailabilityRestore", () => {
	it("restores slots for a known name without a password", async () => {
		const fetchAvailability = vi.fn().mockResolvedValue({
			name: "Ada",
			slots: ["2026-10-05T09:00"],
		});
		const { hook, onRestored } = setup({
			fetchAvailability,
			storedName: "Ada",
		});
		expect(hook.result.current.status).toBe("restoring");
		await waitFor(() => expect(hook.result.current.status).toBe("ready"));
		expect(fetchAvailability).toHaveBeenCalledWith(eventId, "Ada", undefined);
		expect(onRestored).toHaveBeenCalledWith({
			name: "Ada",
			slots: ["2026-10-05T09:00"],
		});
	});

	it("asks for a password when the stored name is protected", async () => {
		const fetchAvailability = vi
			.fn()
			.mockRejectedValue(
				new HttpError(401, "invalid_password", "Wrong password"),
			);
		const { hook, onNeedsPassword, onRestored } = setup({
			fetchAvailability,
			storedName: "Ada",
		});
		await waitFor(() =>
			expect(hook.result.current.status).toBe("needs-password"),
		);
		expect(onRestored).not.toHaveBeenCalled();
		expect(onNeedsPassword).toHaveBeenCalledWith("Ada");
		expect(fetchAvailability).toHaveBeenCalledWith(eventId, "Ada", undefined);
	});

	it("clears selection when the stored name is gone", async () => {
		const fetchAvailability = vi
			.fn()
			.mockRejectedValue(
				new HttpError(404, "availability_not_found", "No availability"),
			);
		const { hook, onCleared, onRestored } = setup({
			fetchAvailability,
			storedName: "Ada",
		});
		await waitFor(() => expect(hook.result.current.status).toBe("ready"));
		expect(onRestored).not.toHaveBeenCalled();
		expect(onCleared).toHaveBeenCalledTimes(1);
	});

	it("ends missing or forbidden events as terminal instead of retryable", async () => {
		const fetchAvailability = vi
			.fn()
			.mockRejectedValue(new HttpError(404, "not_found", "Event not found"));
		const { hook, onCleared, onGone } = setup({
			fetchAvailability,
			storedName: "Ada",
		});
		await waitFor(() => expect(hook.result.current.status).toBe("gone"));
		expect(onCleared).not.toHaveBeenCalled();
		expect(onGone).toHaveBeenCalledTimes(1);
		hook.result.current.retry();
		expect(hook.result.current.status).toBe("gone");
	});

	it("ends forbidden restores as terminal", async () => {
		const fetchAvailability = vi
			.fn()
			.mockRejectedValue(new HttpError(403, "forbidden", "Nope"));
		const { hook, onGone } = setup({
			fetchAvailability,
			storedName: "Ada",
		});
		await waitFor(() => expect(hook.result.current.status).toBe("gone"));
		expect(onGone).toHaveBeenCalledTimes(1);
	});

	it("ends expired events as terminal instead of retryable", async () => {
		const fetchAvailability = vi
			.fn()
			.mockRejectedValue(new HttpError(410, "gone", "Event has expired"));
		const { hook, onCleared, onGone, onRestored } = setup({
			fetchAvailability,
			storedName: "Ada",
		});
		await waitFor(() => expect(hook.result.current.status).toBe("gone"));
		expect(onCleared).not.toHaveBeenCalled();
		expect(onRestored).not.toHaveBeenCalled();
		expect(onGone).toHaveBeenCalledTimes(1);
		hook.result.current.retry();
		expect(hook.result.current.status).toBe("gone");
		expect(fetchAvailability).toHaveBeenCalledTimes(1);
	});

	it("waits for the event query before deciding", async () => {
		const fetchAvailability = vi.fn().mockResolvedValue({
			name: "Ada",
			slots: [],
		});
		const onRestored = vi.fn();
		const onNeedsPassword = vi.fn();
		const onCleared = vi.fn();
		const onGone = vi.fn();
		const hook = renderHook(
			({ settled }: { settled: boolean }) =>
				useOwnAvailabilityRestore({
					eventId,
					eventSettled: settled,
					fetchAvailability: fetchAvailability as never,
					onCleared: () => onCleared(),
					onGone: () => onGone(),
					onNeedsPassword: (name) => onNeedsPassword(name),
					onRestored: (own) => onRestored(own),
					storedName: "Ada",
				}),
			{ initialProps: { settled: false } },
		);
		expect(hook.result.current.status).toBe("restoring");
		await new Promise((r) => setTimeout(r, 20));
		expect(fetchAvailability).not.toHaveBeenCalled();
		hook.rerender({ settled: true });
		await waitFor(() => expect(hook.result.current.status).toBe("ready"));
		expect(fetchAvailability).toHaveBeenCalledTimes(1);
		expect(onRestored).toHaveBeenCalledTimes(1);
	});

	it("reports failed and retries after a network error", async () => {
		const fetchAvailability = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("offline"))
			.mockResolvedValueOnce({ name: "Ada", slots: [] });
		const { hook, onRestored } = setup({
			fetchAvailability,
			storedName: "Ada",
		});
		await waitFor(() => expect(hook.result.current.status).toBe("failed"));
		expect(onRestored).not.toHaveBeenCalled();
		hook.result.current.retry();
		await waitFor(() => expect(hook.result.current.status).toBe("ready"));
		expect(fetchAvailability).toHaveBeenCalledTimes(2);
		expect(onRestored).toHaveBeenCalledTimes(1);
	});

	it("fetches once across parent re-renders while restoring", async () => {
		let resolveFetch!: (value: { name: string; slots: string[] }) => void;
		const fetchAvailability = vi.fn(
			() =>
				new Promise<{ name: string; slots: string[] }>((resolve) => {
					resolveFetch = resolve;
				}),
		);
		const { hook } = setup({ fetchAvailability, storedName: "Ada" });
		expect(hook.result.current.status).toBe("restoring");
		hook.rerender({ storedName: "Ada" } as never);
		hook.rerender({ storedName: "Ada" } as never);
		resolveFetch({ name: "Ada", slots: [] });
		await waitFor(() => expect(hook.result.current.status).toBe("ready"));
		expect(fetchAvailability).toHaveBeenCalledTimes(1);
	});

	it("stays idle without fetching when no name is stored", () => {
		const fetchAvailability = vi.fn();
		const { hook } = setup({ fetchAvailability, storedName: "   " });
		expect(hook.result.current.status).toBe("idle");
		expect(fetchAvailability).not.toHaveBeenCalled();
	});
});
