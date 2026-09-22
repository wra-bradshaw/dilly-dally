import { useQuery } from "@tanstack/react-query";
import { fetchEventDetail } from "#/lib/client";

export function useEventDetail(eventId: string) {
	return useQuery({
		queryFn: () => fetchEventDetail(eventId),
		queryKey: ["event", eventId],
		refetchInterval: 15_000,
		retry: false,
	});
}
