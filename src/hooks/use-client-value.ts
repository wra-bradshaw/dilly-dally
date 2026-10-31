import { useSyncExternalStore } from "react";

function subscribe(): () => void {
	return () => {};
}

export function useClientValue<T>(readClient: () => T, serverValue: T): T {
	return useSyncExternalStore(subscribe, readClient, () => serverValue);
}
