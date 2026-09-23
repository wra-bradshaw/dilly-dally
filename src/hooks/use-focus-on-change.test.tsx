import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFocusOnChange } from "./use-focus-on-change";

function Probe({ active }: { active: boolean }) {
	const ref = useFocusOnChange<HTMLDivElement>(active);
	return (
		<div>
			<div data-testid="target" ref={ref} tabIndex={-1}>
				target
			</div>
		</div>
	);
}

describe("useFocusOnChange", () => {
	it("returns a ref object", () => {
		let seen: unknown;
		function Capture() {
			const ref = useFocusOnChange<HTMLDivElement>(false);
			seen = ref;
			return null;
		}
		render(<Capture />);
		expect(seen).toHaveProperty("current");
	});

	it("moves focus when inactive becomes active", () => {
		const { rerender } = render(<Probe active={false} />);
		expect(document.activeElement).not.toBe(screen.getByTestId("target"));
		rerender(<Probe active={true} />);
		expect(document.activeElement).toBe(screen.getByTestId("target"));
	});

	it("does not steal focus when inactive", () => {
		render(<Probe active={false} />);
		expect(document.activeElement).toBe(document.body);
	});
});
