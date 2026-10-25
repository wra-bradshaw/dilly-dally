import "#/styles.css";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Button } from "#/components/ui/button";

const LONG_URL =
	"https://dally.bradshaw.page/e/cXA6C3pqAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd";

test("invite URL wraps within 360px viewport without horizontal overflow", async () => {
	await page.viewport(360, 800);
	const screen = await render(
		<div style={{ width: "360px" }} data-testid="viewport">
			<div className="mx-auto w-full min-w-0 pt-6 pb-16">
				<p
					className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
					data-testid="invite-row"
				>
					<a
						className="inline-flex min-h-6 min-w-0 items-center break-all wrap-anywhere text-primary underline underline-offset-4"
						data-testid="invite-link"
						href={LONG_URL}
					>
						{LONG_URL}
					</a>
					<Button
						className="min-h-6 shrink-0"
						size="xs"
						type="button"
						variant="outline"
					>
						Copy
					</Button>
					<Button
						className="min-h-6 shrink-0"
						size="xs"
						type="button"
						variant="outline"
					>
						Copy agent prompt
					</Button>
				</p>
			</div>
		</div>,
	);
	const viewport = screen.container.querySelector(
		'[data-testid="viewport"]',
	) as HTMLElement;
	const row = screen.container.querySelector(
		'[data-testid="invite-row"]',
	) as HTMLElement;
	const link = screen.container.querySelector(
		'[data-testid="invite-link"]',
	) as HTMLAnchorElement;
	await expect.element(screen.getByText("Copy agent prompt")).toBeVisible();
	expect(link.getAttribute("href")).toBe(LONG_URL);
	expect(link.textContent).toContain(LONG_URL);
	expect(link.className).toMatch(/break-all/);
	expect(link.className).toMatch(/min-w-0/);
	expect(row.className).toMatch(/flex-wrap/);
	expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1);
	expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
	const shot = await page.screenshot({
		path: "__screenshots__/invite-url-wrap-360.png",
	});
	expect(typeof shot).toBe("string");
});
