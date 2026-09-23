import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRadioGroup } from "./use-radio-group";

function Probe({
	onChange,
	value,
}: {
	onChange: (v: "dates" | "weekly") => void;
	value: "dates" | "weekly";
}) {
	const group = useRadioGroup({
		onChange,
		value,
		values: ["dates", "weekly"] as const,
	});
	return (
		<div>
			<span id="mode-label">Specific dates or a weekly repeat?</span>
			<div
				aria-labelledby="mode-label"
				data-testid="radiogroup"
				role="radiogroup"
				onKeyDown={group.onKeyDown}
			>
				<button
					{...group.getOptionProps("dates")}
					onClick={() => onChange("dates")}
					type="button"
				>
					Specific dates
				</button>
				<button
					{...group.getOptionProps("weekly")}
					onClick={() => onChange("weekly")}
					type="button"
				>
					Weekly
				</button>
			</div>
		</div>
	);
}

describe("useRadioGroup", () => {
	it("exposes a single tab stop on the checked option", () => {
		render(<Probe onChange={() => {}} value="dates" />);
		const options = screen.getAllByRole("radio");
		expect(options).toHaveLength(2);
		expect(options[0]?.getAttribute("aria-checked")).toBe("true");
		expect(options[0]?.getAttribute("tabindex")).toBe("0");
		expect(options[1]?.getAttribute("aria-checked")).toBe("false");
		expect(options[1]?.getAttribute("tabindex")).toBe("-1");
	});

	it("moves selection with arrow keys", () => {
		const onChange = vi.fn();
		render(<Probe onChange={onChange} value="dates" />);
		const first = screen.getByRole("radio", { name: "Specific dates" });
		(first as HTMLButtonElement).focus();
		expect(document.activeElement).toBe(first);
		first.dispatchEvent(
			new KeyboardEvent("keydown", {
				bubbles: true,
				cancelable: true,
				key: "ArrowRight",
			}),
		);
		expect(onChange).toHaveBeenCalledWith("weekly");
	});
});
