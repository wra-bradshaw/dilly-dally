import { useState } from "react";

export function useTooltipOpen(forcedOpen: boolean): {
	open: boolean;
	onOpenChange: (open: boolean) => void;
} {
	const [userOpen, setUserOpen] = useState(false);
	return {
		onOpenChange: setUserOpen,
		open: userOpen || forcedOpen,
	};
}
