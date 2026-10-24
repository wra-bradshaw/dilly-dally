import { useQuery } from "@tanstack/react-query";
import { fetchOwnSessionServerFn } from "#/lib/event-detail-loader";

export function useOwnSession(eventId: string) {
	return useQuery({
		queryFn: () => fetchOwnSessionServerFn({ data: eventId }),
		queryKey: ["own-session", eventId],
		retry: false,
		staleTime: 15_000,
	});
}
