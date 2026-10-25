export function inviteUrl(eventId: string, origin: string): string {
	const base = origin.replace(/\/+$/, "");
	if (base === "") return `/e/${eventId}`;
	return `${base}/e/${eventId}`;
}
