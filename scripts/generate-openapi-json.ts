import { writeFileSync } from "node:fs";
import { getOpenApiSpec, serializeSpec } from "../src/lib/openapi";

const spec = getOpenApiSpec("https://example.com");
writeFileSync(new URL("./openapi.json", import.meta.url), serializeSpec(spec));
console.log("wrote scripts/openapi.json");
