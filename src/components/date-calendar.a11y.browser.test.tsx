import "#/styles.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { DateCalendar } from "./date-calendar";

test("calendar group exposes visible label and hint", async () => {
	const screen = await render(
		<div>
			<span id="dates-label">What dates might work?</span>
			<p id="dates-hint">Click and drag dates to choose possibilities.</p>
			<DateCalendar
				describedBy="dates-hint"
				labelledBy="dates-label"
				maxDate="2026-09-30"
				minDate="2026-09-22"
				onCommit={() => {}}
				selected={new Set()}
			/>
		</div>,
	);
	const group = screen.container.querySelector('[data-slot="date-calendar"]');
	expect(group?.getAttribute("role")).toBe("group");
	expect(group?.getAttribute("aria-labelledby")).toBe("dates-label");
	expect(group?.getAttribute("aria-describedby")).toBe("dates-hint");
});

test("month titles are real headings", async () => {
	const screen = await render(
		<DateCalendar
			maxDate="2026-09-30"
			minDate="2026-09-22"
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	const heading = screen.getByRole("heading", { name: "September 2026" });
	await expect.element(heading).toBeVisible();
	expect(heading.element().tagName.toLowerCase()).toBe("h3");
});

test("off-range days render as non-interactive filler", async () => {
	const screen = await render(
		<DateCalendar
			maxDate="2026-09-28"
			minDate="2026-09-23"
			onCommit={() => {}}
			selected={new Set()}
		/>,
	);
	const offDay = screen.container.querySelector('[data-day="2026-09-22"]');
	expect(offDay).toBeNull();
	const filler = screen.container.querySelectorAll("[data-filler]");
	expect(filler.length).toBeGreaterThan(0);
	for (const node of Array.from(filler)) {
		expect(node.tagName.toLowerCase()).not.toBe("button");
		expect(node.getAttribute("aria-hidden")).toBe("true");
	}
	expect(
		screen.container.querySelector('button[aria-hidden="true"]'),
	).toBeNull();
});
