import { type HourCycle, systemHourCycle } from "#/lib/time-slots";
import { useClientValue } from "./use-client-value";

export function useHourCycle(): HourCycle {
	return useClientValue(systemHourCycle, "h12");
}
