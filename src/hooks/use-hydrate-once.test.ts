import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHydrateOnce } from "./use-hydrate-once";

describe("useHydrateOnce", () => {
	it("applies a late-arriving value exactly once", async () => {
		const apply = vi.fn();
		let value: { name: string } | null = null;
		const { rerender } = renderHook<unknown, { v: { name: string } | null }>(
			({ v }) => {
				useHydrateOnce(v, apply);
			},
			{ initialProps: { v: value } },
		);
		rerender({ v: value });
		expect(apply).not.toHaveBeenCalled();
		value = { name: "Ada" };
		rerender({ v: value });
		expect(apply).toHaveBeenCalledTimes(1);
		expect(apply).toHaveBeenCalledWith({ name: "Ada" });
		rerender({ v: { name: "Bob" } });
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it("skips a value already present at mount", () => {
		const apply = vi.fn();
		renderHook(
			({ v }: { v: { name: string } | null }) => {
				useHydrateOnce(v, apply);
			},
			{ initialProps: { v: { name: "Ada" } } },
		);
		expect(apply).not.toHaveBeenCalled();
	});

	it("never fires while the value stays nullish", () => {
		const apply = vi.fn();
		const { rerender } = renderHook<unknown, { v: string | null | undefined }>(
			({ v }) => {
				useHydrateOnce(v, apply);
			},
			{ initialProps: { v: null } },
		);
		rerender({ v: undefined });
		rerender({ v: null });
		expect(apply).not.toHaveBeenCalled();
	});

	it("invokes the latest callback", () => {
		const first = vi.fn();
		const second = vi.fn();
		const { rerender } = renderHook<
			unknown,
			{ cb: (s: string) => void; v: string | null }
		>(
			({ v, cb }) => {
				useHydrateOnce(v, cb);
			},
			{ initialProps: { cb: first, v: null } },
		);
		rerender({ cb: second, v: null });
		rerender({ cb: second, v: "Ada" });
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledWith("Ada");
	});
});
