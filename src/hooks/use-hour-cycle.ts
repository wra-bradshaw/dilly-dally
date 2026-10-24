import { useSyncExternalStore } from "react";
import { type HourCycle, systemHourCycle } from "#/lib/time-slots";

function subscribe(): () => void {
	return () => {};
}

function clientSnapshot(): HourCycle {
	return systemHourCycle();
}

function serverSnapshot(): HourCycle {
	return "h12";
}

export function useHourCycle(): HourCycle {
	return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
