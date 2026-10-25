import { describe, expect, it } from "vitest";
import { formatSlotLabel } from "#/lib/time-slots";

function hourOptions(): string[] {
	return Array.from({ length: 48 }, (_, i) => {
		const h = Math.floor(i / 2);
		const m = i % 2 === 0 ? "00" : "30";
		return `${String(h).padStart(2, "0")}:${m}`;
	});
}

describe("time select labels", () => {
	it("renders the longest 12-hour labels without abbreviation", () => {
		expect(formatSlotLabel("2026-01-01T12:30", "h12")).toBe("12:30 PM");
		expect(formatSlotLabel("2026-01-01T00:30", "h12")).toBe("12:30 AM");
		expect(formatSlotLabel("2026-01-01T09:00", "h12")).toBe("9:00 AM");
		expect(formatSlotLabel("2026-01-01T17:00", "h12")).toBe("5:00 PM");
	});

	it("uses the longest label as the trigger sizing bound", () => {
		const labels = hourOptions().map((h) =>
			formatSlotLabel(`2026-01-01T${h}`, "h12"),
		);
		const longest = labels.reduce((a, b) => (b.length > a.length ? b : a));
		expect(longest).toHaveLength(8);
		expect(labels).toContain("12:30 PM");
		expect(labels).toContain("12:30 AM");
	});

	it("renders 24-hour trigger labels when the system uses h23", () => {
		expect(formatSlotLabel("2026-01-01T09:00", "h23")).toBe("09:00");
		expect(formatSlotLabel("2026-01-01T13:00", "h23")).toBe("13:00");
		expect(formatSlotLabel("2026-01-01T00:00", "h23")).toBe("00:00");
		expect(formatSlotLabel("2026-01-01T12:30", "h23")).toBe("12:30");
		expect(formatSlotLabel("2026-01-01T23:30", "h23")).toBe("23:30");
		expect(formatSlotLabel("2026-01-01T17:00", "h23")).toBe("17:00");
	});

	it("keeps every 24-hour option at fixed width", () => {
		for (const h of hourOptions()) {
			expect(formatSlotLabel(`2026-01-01T${h}`, "h23")).toMatch(
				/^\d{2}:\d{2}$/,
			);
		}
	});
});
