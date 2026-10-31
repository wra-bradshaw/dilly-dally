import { DEFAULT_LOCALE, systemLocale } from "#/lib/time-slots";
import { useClientValue } from "./use-client-value";

export function useDateLocale(): string {
	return useClientValue(systemLocale, DEFAULT_LOCALE);
}
