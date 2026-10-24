import { isBot } from "isbot";

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);

function parseAcceptEntry(entry: string): { q: number; type: string } | null {
	const [rawType, ...rawParams] = entry.split(";");
	const type = rawType?.trim().toLowerCase() ?? "";
	if (type === "") return null;
	let q = 1;
	for (const param of rawParams) {
		const [key, value] = param.split("=");
		if (key?.trim().toLowerCase() === "q") {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) q = parsed;
		}
	}
	return { q, type };
}

export type MarkdownPreference = "accepted" | "refused" | "absent";

export function markdownPreference(accept: string | null): MarkdownPreference {
	if (!accept) return "absent";
	let refused = false;
	for (const entry of accept.split(",")) {
		const parsed = parseAcceptEntry(entry);
		if (!parsed || !MARKDOWN_TYPES.has(parsed.type)) continue;
		if (parsed.q > 0) return "accepted";
		refused = true;
	}
	return refused ? "refused" : "absent";
}

export function acceptsMarkdown(accept: string | null): boolean {
	return markdownPreference(accept) === "accepted";
}

export function isAgentUserAgent(userAgent: string | null): boolean {
	return isBot(userAgent);
}

export function wantsMarkdown(request: Request): boolean {
	if (request.method !== "GET" && request.method !== "HEAD") return false;
	const preference = markdownPreference(request.headers.get("accept"));
	if (preference === "refused") return false;
	if (preference === "accepted") return true;
	return isAgentUserAgent(request.headers.get("user-agent"));
}
