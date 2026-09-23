import { useRef, useState } from "react";

export function useCopyToClipboard(resetMs = 2000): {
	copied: boolean;
	copyError: boolean;
	copy: (text: string) => Promise<void>;
} {
	const [copied, setCopied] = useState(false);
	const [copyError, setCopyError] = useState(false);
	const timer = useRef<number | null>(null);

	const copy = async (text: string) => {
		setCopyError(false);
		let ok = false;
		try {
			await navigator.clipboard.writeText(text);
			ok = true;
		} catch {
			try {
				const area = document.createElement("textarea");
				area.value = text;
				document.body.appendChild(area);
				area.select();
				ok = document.execCommand("copy");
				area.remove();
			} catch {
				ok = false;
			}
		}
		setCopied(ok);
		setCopyError(!ok);
		if (timer.current !== null) window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			setCopied(false);
			setCopyError(false);
		}, resetMs);
	};

	return { copied, copy, copyError };
}
