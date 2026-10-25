import "#/styles.css";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { formatSlotLabel } from "#/lib/time-slots";

function hourOptions(): string[] {
	return Array.from({ length: 48 }, (_, i) => {
		const h = Math.floor(i / 2);
		const m = i % 2 === 0 ? "00" : "30";
		return `${String(h).padStart(2, "0")}:${m}`;
	});
}

async function assertTriggerFits(name: string) {
	const trigger = document.querySelector(
		`[aria-label="${name}"]`,
	) as HTMLElement | null;
	if (!trigger) throw new Error(`missing trigger ${name}`);
	const value = trigger.querySelector(
		'[data-slot="select-value"]',
	) as HTMLElement | null;
	if (!value) throw new Error(`missing value ${name}`);
	expect(value.textContent?.length).toBeGreaterThan(0);
	expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth + 1);
}

test("time select triggers show full labels without clipping at mobile width", async () => {
	const screen = await render(
		<div style={{ width: "360px" }}>
			<div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
				<span className="text-xs text-muted-foreground">No earlier than</span>
				<Select value="09:00">
					<SelectTrigger
						aria-label="No earlier than"
						className="w-36 shrink-0"
						id="start-time"
						type="button"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{hourOptions().map((h) => (
							<SelectItem key={h} value={h}>
								{formatSlotLabel(`2026-01-01T${h}`, "h12")}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<span className="text-xs text-muted-foreground">No later than</span>
				<Select value="12:30">
					<SelectTrigger
						aria-label="No later than"
						className="w-36 shrink-0"
						id="end-time"
						type="button"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{hourOptions().map((h) => (
							<SelectItem key={h} value={h}>
								{formatSlotLabel(`2026-01-01T${h}`, "h12")}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>,
	);
	await expect
		.element(screen.getByRole("combobox", { name: "No earlier than" }))
		.toBeVisible();
	try {
		await document.fonts.ready;
	} catch {}
	await assertTriggerFits("No earlier than");
	await assertTriggerFits("No later than");
	const endValue = document
		.querySelector('[aria-label="No later than"]')
		?.querySelector('[data-slot="select-value"]');
	expect(endValue?.textContent).toBe("12:30 PM");
});

test("time select triggers show full 24-hour labels via hourCycle h23", async () => {
	const screen = await render(
		<div style={{ width: "360px" }}>
			<div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
				<Select value="09:00">
					<SelectTrigger
						aria-label="No earlier than"
						className="w-36 shrink-0"
						type="button"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{hourOptions().map((h) => (
							<SelectItem key={h} value={h}>
								{formatSlotLabel(`2026-01-01T${h}`, "h23")}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value="17:00">
					<SelectTrigger
						aria-label="No later than"
						className="w-36 shrink-0"
						type="button"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{hourOptions().map((h) => (
							<SelectItem key={h} value={h}>
								{formatSlotLabel(`2026-01-01T${h}`, "h23")}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>,
	);
	await expect
		.element(screen.getByRole("combobox", { name: "No earlier than" }))
		.toBeVisible();
	try {
		await document.fonts.ready;
	} catch {}
	await assertTriggerFits("No earlier than");
	await assertTriggerFits("No later than");
	const startValue = document
		.querySelector('[aria-label="No earlier than"]')
		?.querySelector('[data-slot="select-value"]');
	const endValue = document
		.querySelector('[aria-label="No later than"]')
		?.querySelector('[data-slot="select-value"]');
	expect(startValue?.textContent).toBe("09:00");
	expect(endValue?.textContent).toBe("17:00");
});
