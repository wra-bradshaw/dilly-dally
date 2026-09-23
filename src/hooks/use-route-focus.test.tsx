import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRouteFocus } from "./use-route-focus";

function setupMain(heading = "Plan a new event"): HTMLElement {
	document.body.innerHTML = `<main id="main"><h1>${heading}</h1></main>`;
	const h1 = document.querySelector("main h1") as HTMLElement;
	return h1;
}

describe("useRouteFocus", () => {
	it("moves focus to the main heading when the route key changes", () => {
		const h1 = setupMain();
		const { rerender } = renderHook(
			({ routeKey }: { routeKey: string }) => useRouteFocus(routeKey),
			{ initialProps: { routeKey: "/" } },
		);
		expect(document.activeElement).not.toBe(h1);
		rerender({ routeKey: "/e/abc" });
		expect(document.activeElement).toBe(h1);
		expect(h1.getAttribute("tabindex")).toBe("-1");
	});

	it("does not steal focus on first mount", () => {
		const h1 = setupMain();
		renderHook(
			({ routeKey }: { routeKey: string }) => useRouteFocus(routeKey),
			{ initialProps: { routeKey: "/" } },
		);
		expect(document.activeElement).not.toBe(h1);
	});
});
