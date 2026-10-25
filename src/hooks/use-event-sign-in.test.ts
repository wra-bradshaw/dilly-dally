import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "#/lib/http-error";
import { useEventSignIn } from "./use-event-sign-in";

function httpError(code: string, status = 400) {
	return new HttpError(status, code, code);
}

function setup(overrides: Partial<Parameters<typeof useEventSignIn>[0]> = {}) {
	const setName = vi.fn();
	const setPassword = vi.fn();
	const setActiveName = vi.fn();
	const setStoredName = vi.fn();
	const setSelected = vi.fn();
	const setSignedIn = vi.fn();
	const lastSavedRef = { current: new Set<string>() };
	const invalidateOwnSession = vi.fn();
	const { result, rerender } = renderHook(
		(props: Parameters<typeof useEventSignIn>[0]) => useEventSignIn(props),
		{
			initialProps: {
				createSession: vi.fn(),
				eventId: "ev1",
				fetchOwn: vi.fn(),
				invalidateOwnSession,
				lastSavedRef,
				name: "Ada",
				password: "",
				setActiveName,
				setName,
				setPassword,
				setSelected,
				setSignedIn,
				setStoredName,
				...overrides,
			} as Parameters<typeof useEventSignIn>[0],
		},
	);
	return {
		invalidateOwnSession,
		lastSavedRef,
		rerender,
		result,
		setActiveName,
		setName,
		setPassword,
		setSelected,
		setSignedIn,
		setStoredName,
	};
}

describe("useEventSignIn", () => {
	it("rejects an empty name without touching the session", async () => {
		const createSession = vi.fn();
		const { result, setSignedIn } = setup({
			createSession,
			name: "   ",
		});
		await act(async () => {
			await result.current.signIn();
		});
		expect(result.current.signError).toBe("Enter your name to continue.");
		expect(createSession).not.toHaveBeenCalled();
		expect(setSignedIn).not.toHaveBeenCalled();
		expect(result.current.signing).toBe(false);
	});

	it("rejects a short password before any network call", async () => {
		const createSession = vi.fn();
		const fetchOwn = vi.fn();
		const { result, setSignedIn } = setup({
			createSession,
			fetchOwn,
			name: "Ada",
			password: "abc",
		});
		await act(async () => {
			await result.current.signIn();
		});
		expect(result.current.signError).toBe(
			"Password must be at least 4 characters.",
		);
		expect(createSession).not.toHaveBeenCalled();
		expect(fetchOwn).not.toHaveBeenCalled();
		expect(setSignedIn).not.toHaveBeenCalled();
	});

	it("writes the four targets in order and signs in on the primary path", async () => {
		const createSession = vi.fn().mockResolvedValue({ name: "Ada Lovelace" });
		const fetchOwn = vi
			.fn()
			.mockResolvedValue({ name: "Ada Lovelace", slots: ["a", "b"] });
		const {
			invalidateOwnSession,
			lastSavedRef,
			result,
			setActiveName,
			setName,
			setPassword,
			setSelected,
			setSignedIn,
			setStoredName,
		} = setup({ createSession, fetchOwn, name: " ada ", password: "secret" });
		await act(async () => {
			await result.current.signIn();
		});
		expect(createSession).toHaveBeenCalledWith("ev1", {
			name: "ada",
			password: "secret",
		});
		expect(fetchOwn).toHaveBeenCalledWith("ev1", "Ada Lovelace", undefined);
		expect(lastSavedRef.current).toEqual(new Set(["a", "b"]));
		expect(setSelected).toHaveBeenCalledWith(new Set(["a", "b"]));
		expect(setActiveName).toHaveBeenCalledWith("Ada Lovelace");
		expect(setStoredName).toHaveBeenCalledWith("Ada Lovelace");
		expect(setName).toHaveBeenCalledWith("Ada Lovelace");
		expect(setPassword).toHaveBeenCalledWith("");
		expect(invalidateOwnSession).toHaveBeenCalledTimes(1);
		expect(setSignedIn).toHaveBeenCalledWith(true);
		const order = (m: { mock: { invocationCallOrder: number[] } }) =>
			m.mock.invocationCallOrder[0] as number;
		expect(order(setSelected)).toBeLessThan(order(setActiveName));
		expect(order(setActiveName)).toBeLessThan(order(setStoredName));
		expect(order(setStoredName)).toBeLessThan(order(setSignedIn));
		expect(result.current.signing).toBe(false);
		expect(result.current.signError).toBe("");
	});

	it("falls back to a direct fetch when the session already exists", async () => {
		const createSession = vi
			.fn()
			.mockRejectedValue(httpError("availability_not_found", 404));
		const fetchOwn = vi.fn().mockResolvedValue({ name: "Ada", slots: ["x"] });
		const { lastSavedRef, result, setName, setSelected, setSignedIn } = setup({
			createSession,
			fetchOwn,
			name: "Ada",
			password: "secret",
		});
		await act(async () => {
			await result.current.signIn();
		});
		expect(fetchOwn).toHaveBeenCalledWith("ev1", "Ada", "secret");
		expect(lastSavedRef.current).toEqual(new Set(["x"]));
		expect(setSelected).toHaveBeenCalledWith(new Set(["x"]));
		expect(setName).not.toHaveBeenCalled();
		expect(setSignedIn).toHaveBeenCalledWith(true);
	});

	it("starts fresh when neither the session nor prior availability exists", async () => {
		const createSession = vi
			.fn()
			.mockRejectedValue(httpError("availability_not_found", 404));
		const fetchOwn = vi
			.fn()
			.mockRejectedValue(httpError("availability_not_found", 404));
		const { lastSavedRef, result, setActiveName, setSelected, setSignedIn } =
			setup({ createSession, fetchOwn, name: "  Ada  " });
		await act(async () => {
			await result.current.signIn();
		});
		expect(lastSavedRef.current).toEqual(new Set());
		expect(setSelected).toHaveBeenCalledWith(new Set());
		expect(setActiveName).toHaveBeenCalledWith("Ada");
		expect(setSignedIn).toHaveBeenCalledWith(true);
	});

	it("surfaces session errors without signing in", async () => {
		const createSession = vi
			.fn()
			.mockRejectedValue(httpError("invalid_password", 403));
		const fetchOwn = vi.fn();
		const { result, setSelected, setSignedIn } = setup({
			createSession,
			fetchOwn,
		});
		await act(async () => {
			await result.current.signIn();
		});
		expect(result.current.signError).toBe(
			"That name is taken with a different password.",
		);
		expect(fetchOwn).not.toHaveBeenCalled();
		expect(setSelected).not.toHaveBeenCalled();
		expect(setSignedIn).not.toHaveBeenCalled();
		expect(result.current.signing).toBe(false);
	});

	it("surfaces fallback errors without signing in", async () => {
		const createSession = vi
			.fn()
			.mockRejectedValue(httpError("availability_not_found", 404));
		const fetchOwn = vi
			.fn()
			.mockRejectedValue(httpError("invalid_password", 403));
		const { result, setSignedIn } = setup({ createSession, fetchOwn });
		await act(async () => {
			await result.current.signIn();
		});
		expect(result.current.signError).toBe(
			"That name is taken with a different password.",
		);
		expect(setSignedIn).not.toHaveBeenCalled();
	});

	it("ignores a second submit while signing is in flight", async () => {
		let release!: (v: { name: string }) => void;
		const createSession = vi.fn(
			() => new Promise<{ name: string }>((res) => (release = res)),
		);
		const fetchOwn = vi.fn().mockResolvedValue({ name: "Ada", slots: [] });
		const { result } = setup({ createSession, fetchOwn });
		let first!: Promise<void>;
		act(() => {
			first = result.current.signIn();
		});
		expect(result.current.signing).toBe(true);
		await act(async () => {
			await result.current.signIn();
		});
		expect(createSession).toHaveBeenCalledTimes(1);
		await act(async () => {
			release({ name: "Ada" });
			await first;
		});
		expect(result.current.signing).toBe(false);
	});
});
