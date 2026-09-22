import { describe, expect, it } from "vitest";
import { buildColumns } from "./grid-model";

describe("buildColumns", () => {
	it("groups slots by date with labels", () => {
		const cols = buildColumns(
			["2026-10-05T09:00", "2026-10-05T09:15", "2026-10-06T09:00"],
			"America/New_York",
			"America/New_York",
		);
		expect(cols.map((c) => c.date)).toEqual(["2026-10-05", "2026-10-06"]);
		expect(cols[0].cells.map((c) => c.id)).toEqual([
			"2026-10-05T09:00",
			"2026-10-05T09:15",
		]);
		expect(cols[0].cells[0].label).toBe("9:00 AM");
		expect(cols[0].cells[0].hourStart).toBe(true);
		expect(cols[0].cells[1].hourStart).toBe(false);
	});

	it("regroups when the viewer zone shifts dates", () => {
		const cols = buildColumns(
			["2026-10-05T09:00"],
			"America/New_York",
			"Australia/Sydney",
		);
		expect(cols[0].date).toBe("2026-10-06");
		expect(cols[0].cells[0].label).toBe("12:00 AM");
	});

	it("returns empty for empty universe", () => {
		expect(buildColumns([], "UTC", "UTC")).toEqual([]);
	});
});
