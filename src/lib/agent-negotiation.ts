import { isBot } from "isbot";

const MARKDOWN_TYPES = new Set(["text/markdown", "text/x-markdown"]);
const HTML_TYPES = new Set(["text/html"]);

function acceptQuality(
	accept: string | null,
	types: Set<string>,
): number | null {
	if (!accept) return null;
	let best: number | null = null;
	for (const entry of accept.split(",")) {
		const parsed = parseAcceptEntry(entry);
		if (!parsed || !types.has(parsed.type)) continue;
		best = best === null ? parsed.q : Math.max(best, parsed.q);
	}
	return best;
}

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

export function isAgentUserAgent(userAgent: string | null): boolean {
	return isBot(userAgent);
}

export function wantsMarkdown(request: Request): boolean {
	if (request.method !== "GET" && request.method !== "HEAD") return false;
	const accept = request.headers.get("accept");
	const markdownQ = acceptQuality(accept, MARKDOWN_TYPES);
	if (markdownQ !== null && markdownQ <= 0) return false;
	const htmlQ = acceptQuality(accept, HTML_TYPES);
	if (markdownQ !== null && markdownQ > 0) {
		if (htmlQ === null || htmlQ <= 0) return true;
		return markdownQ > htmlQ;
	}
	if (htmlQ !== null && htmlQ > 0) return false;
	return isAgentUserAgent(request.headers.get("user-agent"));
}
