import "#/styles.css";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { AvailabilityGrid } from "#/components/availability-grid";
import { buildColumns } from "#/components/grid-model";
import { GroupHeatmap } from "#/components/group-heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";

function sixDayUniverse(): string[] {
	const days = [
		"2026-10-25",
		"2026-10-26",
		"2026-10-27",
		"2026-10-28",
		"2026-10-29",
		"2026-10-30",
	];
	const times = [
		"09:00",
		"09:30",
		"10:00",
		"10:30",
		"11:00",
		"11:30",
		"12:00",
		"12:30",
	];
	return days.flatMap((d) => times.map((t) => `${d}T${t}`));
}

function widestOverflow(): string {
	const out: string[] = [];
	const vw = window.innerWidth;
	for (const el of document.querySelectorAll("*")) {
		const h = el as HTMLElement;
		let w = 0;
		try {
			w = h.scrollWidth;
		} catch {
			continue;
		}
		if (w > vw + 1 && h.clientWidth > 0) {
			const cls =
				typeof h.className === "string"
					? h.className.split(/\s+/).slice(0, 8).join(".")
					: "";
			out.push(
				`${h.tagName.toLowerCase()}${cls ? `.${cls}` : ""} scrollWidth=${w} clientWidth=${h.clientWidth}`,
			);
		}
	}
	return out.length > 0 ? out.join("\n") : "(no element wider than viewport)";
}

test("event page with 6-day grids fits a 320px viewport without page overflow", async () => {
	await page.viewport(320, 800);
	const columns = buildColumns(sixDayUniverse(), {
		eventTimezone: "UTC",
		mode: "dates",
		viewTimezone: "UTC",
	});
	const counts = new Map(
		columns.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
	const screen = await render(
		<div
			className="mx-auto min-w-0 max-w-full w-[min(1080px,calc(100%-2rem))] overflow-x-hidden pt-6 pb-16"
			data-testid="event-page"
		>
			<h1 className="font-heading mt-2 text-3xl font-bold">Team offsite</h1>
			<div
				className="mt-4 flex flex-wrap items-center gap-2 text-sm"
				data-testid="tz-row"
			>
				<Label htmlFor="tz-view">Show times in</Label>
				<Select defaultValue="UTC">
					<SelectTrigger className="w-80 max-w-full" id="tz-view" type="button">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="UTC">UTC (event time)</SelectItem>
						<SelectItem value="America/New_York">
							America/New_York (your time)
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<Card className="mt-4 min-w-0 max-w-full" data-testid="own-card">
				<CardHeader>
					<CardTitle>Your availability</CardTitle>
				</CardHeader>
				<CardContent>
					<AvailabilityGrid
						columns={columns}
						onCommit={() => {}}
						selected={new Set()}
					/>
				</CardContent>
			</Card>
			<Card className="mt-4 min-w-0 max-w-full" data-testid="group-card">
				<CardHeader>
					<CardTitle>Group&apos;s availability</CardTitle>
				</CardHeader>
				<CardContent>
					<GroupHeatmap
						allNames={["Ada"]}
						columns={columns}
						counts={counts}
						eventTimezone="UTC"
						total={1}
						viewTimezone="UTC"
					/>
				</CardContent>
			</Card>
		</div>,
	);
	await expect.element(screen.getByText("Group's availability")).toBeVisible();
	const doc = document.documentElement;
	const viewportWidth = 320;
	expect(
		window.innerWidth,
		`viewport expanded beyond ${viewportWidth}px (content forced the layout wider):\n${widestOverflow()}`,
	).toBeLessThanOrEqual(viewportWidth + 1);
	expect(
		doc.scrollWidth,
		`page overflows ${viewportWidth}px viewport (innerWidth=${window.innerWidth}):\n${widestOverflow()}`,
	).toBeLessThanOrEqual(viewportWidth + 1);
});

test("event page with 6-day grids fits a 360px viewport without page overflow", async () => {
	await page.viewport(360, 800);
	const columns = buildColumns(sixDayUniverse(), {
		eventTimezone: "UTC",
		mode: "dates",
		viewTimezone: "UTC",
	});
	const counts = new Map(
		columns.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 1, names: ["Ada"] }]),
		),
	);
	const screen = await render(
		<div
			className="mx-auto w-[min(1080px,calc(100%-2rem))] pt-6 pb-16"
			data-testid="event-page"
		>
			<Card className="mt-4" data-testid="group-card">
				<CardHeader>
					<CardTitle>Group&apos;s availability</CardTitle>
				</CardHeader>
				<CardContent>
					<GroupHeatmap
						allNames={["Ada"]}
						columns={columns}
						counts={counts}
						eventTimezone="UTC"
						total={1}
						viewTimezone="UTC"
					/>
				</CardContent>
			</Card>
		</div>,
	);
	await expect.element(screen.getByText("Group's availability")).toBeVisible();
	const doc = document.documentElement;
	expect(window.innerWidth).toBeLessThanOrEqual(361);
	expect(
		doc.scrollWidth,
		`page overflows 360px viewport (innerWidth=${window.innerWidth}):\n${widestOverflow()}`,
	).toBeLessThanOrEqual(window.innerWidth + 1);
});

test("non-contiguous 12-day grid renders gap markers and scrolls inside the card", async () => {
	await page.viewport(320, 800);
	const days = [
		"2026-10-05",
		"2026-10-06",
		"2026-10-08",
		"2026-10-09",
		"2026-10-12",
		"2026-10-13",
		"2026-10-14",
		"2026-10-15",
		"2026-10-19",
		"2026-10-20",
		"2026-10-21",
		"2026-10-22",
	];
	const columns = buildColumns(
		days.flatMap((d) => [`${d}T09:00`, `${d}T09:30`]),
		{
			eventTimezone: "UTC",
			mode: "dates",
			viewTimezone: "UTC",
		},
	);
	const screen = await render(
		<div
			className="mx-auto min-w-0 max-w-full w-[min(1080px,calc(100%-2rem))] overflow-x-hidden pt-6 pb-16"
			data-testid="event-page"
		>
			<Card className="mt-4 min-w-0 max-w-full" data-testid="group-card">
				<CardHeader>
					<CardTitle>Group&apos;s availability</CardTitle>
				</CardHeader>
				<CardContent>
					<AvailabilityGrid
						columns={columns}
						onCommit={() => {}}
						selected={new Set()}
					/>
				</CardContent>
			</Card>
		</div>,
	);
	await expect.element(screen.getByText("Group's availability")).toBeVisible();
	expect(screen.container.textContent ?? "").toMatch(/\+\d/);
	const doc = document.documentElement;
	expect(
		doc.scrollWidth,
		`page overflows 320px viewport:\n${widestOverflow()}`,
	).toBeLessThanOrEqual(321);
	const scroller =
		screen.container.querySelector<HTMLElement>(".overflow-x-auto");
	expect(scroller, "grid inner scroller").not.toBeNull();
	expect(
		(scroller as HTMLElement).scrollWidth,
		"wide grid should scroll inside its card",
	).toBeGreaterThan((scroller as HTMLElement).clientWidth);
	const dateHeaders = [
		...screen.container.querySelectorAll<HTMLElement>('th[id*="-col-"]'),
	];
	expect(dateHeaders.length, "date columns rendered").toBeGreaterThan(0);
	for (const th of dateHeaders) {
		expect(
			th.getBoundingClientRect().width,
			"date columns must not cram into the viewport",
		).toBeGreaterThanOrEqual(44);
	}
});
