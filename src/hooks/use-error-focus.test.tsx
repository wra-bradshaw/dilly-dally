import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useErrorFocus } from "./use-error-focus";

function Probe({ error }: { error: string }) {
	const ref = useErrorFocus<HTMLDivElement>(error);
	return (
		<div>
			<label htmlFor="field">Field</label>
			<input id="field" type="text" />
			<div data-testid="summary" ref={ref} tabIndex={-1}>
				{error}
			</div>
		</div>
	);
}

describe("useErrorFocus", () => {
	it("returns a ref object starting empty", () => {
		let seen: unknown;
		function Capture() {
			const ref = useErrorFocus<HTMLDivElement>("");
			seen = ref;
			return null;
		}
		render(<Capture />);
		expect(seen).toHaveProperty("current");
	});

	it("moves focus to the summary when an error appears", async () => {
		const { rerender } = render(<Probe error="" />);
		const summary = screen.getByTestId("summary");
		expect(document.activeElement).not.toBe(summary);
		rerender(<Probe error="Give your event a name." />);
		await screen.findByText("Give your event a name.");
		expect(document.activeElement).toBe(summary);
	});

	it("does not steal focus when there is no error", () => {
		render(<Probe error="" />);
		expect(document.activeElement).toBe(document.body);
	});
});
