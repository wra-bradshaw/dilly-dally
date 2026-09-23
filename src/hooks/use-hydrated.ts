import { useSyncExternalStore } from "react";

function subscribe(): () => void {
	return () => {};
}

function clientSnapshot(): boolean {
	return true;
}

function serverSnapshot(): boolean {
	return false;
}

export function useHydrated(): boolean {
	return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
