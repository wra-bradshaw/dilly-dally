import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Button } from "#/components/ui/button";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const dark = resolvedTheme === "dark";
	return (
		<Button
			aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
			onClick={() => setTheme(dark ? "light" : "dark")}
			size="icon-sm"
			title={dark ? "Switch to light mode" : "Switch to dark mode"}
			type="button"
			variant="ghost"
		>
			<SunIcon className="dark:hidden" />
			<MoonIcon className="hidden dark:block" />
		</Button>
	);
}
