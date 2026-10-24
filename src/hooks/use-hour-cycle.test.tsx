import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useHourCycle } from "./use-hour-cycle";

vi.mock("#/lib/time-slots", async (importOriginal) => {
	const actual = await importOriginal<typeof import("#/lib/time-slots")>();
	return { ...actual, systemHourCycle: () => "h23" };
});

function CycleLabel() {
	return <span>{useHourCycle()}</span>;
}

describe("useHourCycle", () => {
	it("propagates the system hour cycle on the client", () => {
		const { result } = renderHook(() => useHourCycle());
		expect(result.current).toBe("h23");
	});

	it("renders 12-hour labels on the server to match hydration", () => {
		expect(renderToString(<CycleLabel />)).toBe("<span>h12</span>");
	});
});
