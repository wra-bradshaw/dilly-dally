import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;
const FALLBACK = "0.0.0-dev";

function normalizeTagToVersion(tag: string | undefined): string {
	const cleaned = (tag ?? "").trim().replace(/^v/i, "");
	return SEMVER.test(cleaned) ? cleaned : FALLBACK;
}

function chatgptZipName(version: string): string {
	return `dilly-dally-chatgpt-${version}.zip`;
}

function claudeZipName(version: string): string {
	return `dilly-dally-claude-${version}.zip`;
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const staging = join(root, "dist", "plugin-staging");

function resolveVersion(): string {
	const flagIndex = process.argv.indexOf("--version");
	const flagValue = flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
	const raw = flagValue ?? process.env.PLUGIN_VERSION ?? process.env.GITHUB_REF_NAME;
	return normalizeTagToVersion(raw);
}

function stampJsonFile(path: string, version: string): void {
	const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	writeFileSync(path, `${JSON.stringify({ ...parsed, version }, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	const version = resolveVersion();
	const chatgptStage = join(staging, "chatgpt");
	const claudeStage = join(staging, "claude");
	mkdirSync(chatgptStage, { recursive: true });
	mkdirSync(claudeStage, { recursive: true });
	cpSync(join(root, "plugins", "chatgpt"), chatgptStage, { recursive: true });
	cpSync(join(root, "plugins", "claude"), claudeStage, { recursive: true });
	const skillSrc = join(root, "skills", "dilly-dally", "SKILL.md");
	mkdirSync(join(chatgptStage, "skills", "dilly-dally"), { recursive: true });
	mkdirSync(join(claudeStage, "skills", "dilly-dally"), { recursive: true });
	cpSync(skillSrc, join(chatgptStage, "skills", "dilly-dally", "SKILL.md"));
	cpSync(skillSrc, join(claudeStage, "skills", "dilly-dally", "SKILL.md"));
	stampJsonFile(join(chatgptStage, "plugin.json"), version);
	stampJsonFile(join(claudeStage, ".claude-plugin", "plugin.json"), version);
	console.log(version);
	console.log(chatgptZipName(version));
	console.log(claudeZipName(version));
}

export { resolveVersion };
