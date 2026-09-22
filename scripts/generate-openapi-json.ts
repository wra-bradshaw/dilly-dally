import { writeFileSync } from "node:fs";
import { getOpenApiSpec } from "../src/lib/openapi";

const spec = getOpenApiSpec("https://example.com");
writeFileSync(
	new URL("./openapi.json", import.meta.url),
	`${JSON.stringify(spec, null, 2)}\n`,
);
console.log("wrote scripts/openapi.json");
