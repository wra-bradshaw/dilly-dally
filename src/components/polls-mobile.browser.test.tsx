import "#/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { Poll } from "#/lib/client";
import { PollsSection } from "./polls";

function wrapper(children: ReactNode) {
	const client = new QueryClient();
	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function longLabelPolls(): Poll[] {
	return [
		{
			allowMultiple: false,
			id: "p1",
			options: [
				{
					count: 0,
					id: "o1",
					label: "uni cafe (standing room only upstairs)",
					names: [],
				},
				{
					count: 0,
					id: "o2",
					label: "uni cafe (casual downstairs area)",
					names: [],
				},
				{ count: 1, id: "o3", label: "beer (pa's)", names: ["will"] },
				{
					count: 0,
					id: "o4",
					label: "bakery (luna bakehouse croissants)",
					names: [],
				},
			],
			question: "what to do",
			totalVoters: 1,
		},
	];
}

test("long poll labels do not overlap vote counts or Remove buttons at 360px", async () => {
	await page.viewport(360, 800);
	const screen = await render(
		wrapper(
			<div style={{ width: "360px" }} data-testid="viewport">
				<PollsSection
					activeName="will"
					eventId="e1"
					password=""
					polls={longLabelPolls()}
					signedIn
				/>
			</div>,
		),
	);
	await expect.element(screen.getByText("what to do")).toBeVisible();
	await expect.element(screen.getByText("beer (pa's)")).toBeVisible();

	const rows = Array.from(
		screen.container.querySelectorAll(
			'[data-testid="viewport"] [role="radiogroup"] > div, [data-testid="viewport"] fieldset > div',
		),
	) as HTMLElement[];
	expect(rows.length).toBe(4);

	for (const row of rows) {
		expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
	}

	const removeButtons = Array.from(
		screen.container.querySelectorAll('button[aria-label^="Remove"]'),
	) as HTMLElement[];
	expect(removeButtons.length).toBe(3);

	for (const btn of removeButtons) {
		const row = btn.closest("div.relative") as HTMLElement;
		expect(row).not.toBeNull();
		const count = Array.from(row.querySelectorAll("span")).find((s) =>
			/·/.test(s.textContent ?? ""),
		) as HTMLElement | undefined;
		expect(count).toBeDefined();
		if (!count) continue;
		const c = count.getBoundingClientRect();
		const b = btn.getBoundingClientRect();
		const overlapsHorizontally = b.left < c.right - 1 && b.right > c.left + 1;
		const overlapsVertically = b.top < c.bottom - 1 && b.bottom > c.top + 1;
		expect(
			!(overlapsHorizontally && overlapsVertically),
			`Remove button overlaps vote count: count=${JSON.stringify(c)} remove=${JSON.stringify(b)}`,
		).toBe(true);
	}

	await page.screenshot({ path: "__screenshots__/polls-mobile-360.png" });
});
