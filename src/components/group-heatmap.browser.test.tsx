import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { buildColumns } from "./grid-model";
import { GroupHeatmap } from "./group-heatmap";

function crossingColumns() {
	return buildColumns(
		[
			"2026-10-05T19:00",
			"2026-10-05T20:00",
			"2026-10-05T21:00",
			"2026-10-05T22:00",
		],
		"America/New_York",
		"UTC",
	);
}

test("heatmap shares inline date markers with the paint grid", async () => {
	const cols = crossingColumns();
	const counts = new Map(
		cols.flatMap((c) =>
			c.cells.map((cell) => [cell.id, { count: 0, names: [] }]),
		),
	);
	const screen = await render(
		<GroupHeatmap
			allNames={[]}
			columns={cols}
			counts={counts}
			eventTimezone="America/New_York"
			total={0}
			viewTimezone="UTC"
		/>,
	);
	await expect.element(screen.getByText("Mon, 10/5")).toBeVisible();
	await expect.element(screen.getByText("Tue, 10/6")).toBeVisible();
	expect(screen.getByText("Shows as").all()).toHaveLength(0);
});
