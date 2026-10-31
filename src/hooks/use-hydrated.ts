import { useClientValue } from "./use-client-value";

function hydrated(): boolean {
	return true;
}

export function useHydrated(): boolean {
	return useClientValue(hydrated, false);
}
