import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFocusOnSignal } from "./use-focus-on-signal";

function Probe({ signal }: { signal: string | boolean }) {
	const ref = useFocusOnSignal<HTMLDivElement>(signal);
	return (
		<div data-testid="target" ref={ref} tabIndex={-1}>
			target
		</div>
	);
}

describe("useFocusOnSignal", () => {
	it("moves focus when a new error string appears", () => {
		const { rerender } = render(<Probe signal="" />);
		expect(document.activeElement).not.toBe(screen.getByTestId("target"));
		rerender(<Probe signal="Give your event a name." />);
		expect(document.activeElement).toBe(screen.getByTestId("target"));
	});

	it("moves focus when the error message changes", () => {
		const { rerender } = render(<Probe signal="First error." />);
		expect(document.activeElement).toBe(screen.getByTestId("target"));
		(screen.getByTestId("target") as HTMLElement).blur();
		rerender(<Probe signal="Second error." />);
		expect(document.activeElement).toBe(screen.getByTestId("target"));
	});

	it("moves focus when inactive becomes active", () => {
		const { rerender } = render(<Probe signal={false} />);
		expect(document.activeElement).not.toBe(screen.getByTestId("target"));
		rerender(<Probe signal={true} />);
		expect(document.activeElement).toBe(screen.getByTestId("target"));
	});
});
