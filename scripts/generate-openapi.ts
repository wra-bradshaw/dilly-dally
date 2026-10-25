import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../src/lib/openapi-document.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "openapi.json");

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	const document = buildOpenApiDocument("https://example.com");
	writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
	console.log(`wrote ${outPath}`);
}

export { buildOpenApiDocument };
