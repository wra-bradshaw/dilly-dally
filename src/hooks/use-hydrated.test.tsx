import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useHydrated } from "./use-hydrated";

function Probe() {
	const hydrated = useHydrated();
	return <span>{hydrated ? "client" : "server"}</span>;
}

describe("useHydrated", () => {
	it("renders the server snapshot during server rendering", () => {
		expect(renderToString(<Probe />)).toContain("server");
	});

	it("reports hydrated after client mount", () => {
		const { result } = renderHook(() => useHydrated());
		expect(result.current).toBe(true);
	});
});
