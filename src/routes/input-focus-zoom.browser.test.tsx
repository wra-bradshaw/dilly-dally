import "#/styles.css";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";

function fontSizePx(el: Element): number {
	return Number.parseFloat(getComputedStyle(el).fontSize);
}

test("event + index inputs stay >=16px at 360px to avoid iOS zoom", async () => {
	await page.viewport(360, 800);
	const screen = await render(
		<div>
			<Input id="who-name" placeholder="Ada Lovelace" value="Ada" />
			<Input id="who-pass" type="password" value="secret" />
			<Input id="event-name" placeholder="Team offsite" value="Team offsite" />
			<Input id="tz" list="tz-list" value="UTC" />
			<Input id="poll-q" placeholder="Where?" value="Where?" />
			<Input aria-label="Poll option 1" placeholder="Option 1" value="A" />
			<Select value="UTC">
				<SelectTrigger aria-label="tz-view" id="tz-view" type="button">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="UTC">UTC</SelectItem>
				</SelectContent>
			</Select>
		</div>,
	);
	await expect.element(screen.getByPlaceholder("Ada Lovelace")).toBeVisible();
	try {
		await document.fonts.ready;
	} catch {}
	const ids = ["who-name", "who-pass", "event-name", "tz", "poll-q", "tz-view"];
	for (const id of ids) {
		const el = document.getElementById(id);
		if (!el) throw new Error(`missing #${id}`);
		const px = fontSizePx(el);
		expect(px, `#${id} computed font-size`).toBeGreaterThanOrEqual(16);
	}
	const opt = document.querySelector('[aria-label="Poll option 1"]');
	if (!opt) throw new Error("missing poll option");
	expect(
		fontSizePx(opt),
		"poll option computed font-size",
	).toBeGreaterThanOrEqual(16);
});
