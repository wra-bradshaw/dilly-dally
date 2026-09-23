import { useEffect } from "react";

export function useDocumentTitle(title: string): void {
	useEffect(() => {
		const clean = title.trim();
		document.title = clean === "" ? "dilly dally" : `${clean} | dilly dally`;
	}, [title]);
}
