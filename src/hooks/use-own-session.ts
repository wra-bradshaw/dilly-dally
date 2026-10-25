import { useQuery } from "@tanstack/react-query";
import { fetchOwnSession } from "#/lib/client";
import { HttpError } from "#/lib/http-error";

export type OwnSessionResult =
	| { name: string; ok: true; slots: string[] }
	| { code: string; ok: false };

export function useOwnSession(eventId: string) {
	return useQuery({
		queryFn: async (): Promise<OwnSessionResult> => {
			try {
				const own = await fetchOwnSession(eventId);
				return { name: own.name, ok: true, slots: own.slots };
			} catch (err) {
				return {
					code: err instanceof HttpError ? err.code : "error",
					ok: false,
				};
			}
		},
		queryKey: ["own-session", eventId],
		retry: false,
		staleTime: 15_000,
	});
}
