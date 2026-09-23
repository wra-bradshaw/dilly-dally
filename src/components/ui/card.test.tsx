import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardTitle } from "./card";

describe("CardTitle", () => {
	it("renders an h2 by default with the card slot", () => {
		render(<CardTitle>Sign in to add your availability</CardTitle>);
		const heading = screen.getByRole("heading", {
			level: 2,
			name: "Sign in to add your availability",
		});
		expect(heading.tagName).toBe("H2");
		expect(heading).toHaveAttribute("data-slot", "card-title");
	});

	it("renders the requested heading level without losing styling", () => {
		render(<CardTitle level={3}>Group&apos;s availability</CardTitle>);
		const heading = screen.getByRole("heading", { level: 3 });
		expect(heading.tagName).toBe("H3");
		expect(heading.className).toContain("font-heading");
	});
});
