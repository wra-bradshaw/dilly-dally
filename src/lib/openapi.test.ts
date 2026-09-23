import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	astToString,
	COMMENT_HEADER,
	default as openapiTS,
} from "openapi-typescript";
import { describe, expect, it } from "vitest";
import { getOpenApiSpec } from "./openapi";

describe("openapi availability errors", () => {
	const spec = getOpenApiSpec("https://example.com");
	const availability = spec.paths["/api/events/{id}/availability"] as Record<
		string,
		{ responses: Record<string, unknown> }
	>;

	it("documents gone on availability read and write", () => {
		expect(availability.get.responses["410"]).toBeDefined();
		expect(availability.put.responses["410"]).toBeDefined();
	});

	it("documents not-found, auth, slot and throttle codes", () => {
		expect(availability.get.responses["404"]).toBeDefined();
		expect(availability.get.responses["401"]).toBeDefined();
		expect(availability.put.responses["401"]).toBeDefined();
		expect(availability.put.responses["422"]).toBeDefined();
		expect(availability.put.responses["429"]).toBeDefined();
	});

	it("names availability_not_found on the read 404", () => {
		expect(JSON.stringify(availability.get.responses["404"])).toContain(
			"availability_not_found",
		);
	});

	it("documents POST as a PUT alias with matching responses", () => {
		expect(availability.post.responses["200"]).toBeDefined();
		expect(availability.post.responses["422"]).toBeDefined();
		expect(availability.post.responses["429"]).toBeDefined();
	});

	it("documents payload guards on create and availability writes", () => {
		const spec = getOpenApiSpec("https://example.com");
		const create = spec.paths["/api/events"] as Record<
			string,
			{ responses: Record<string, unknown> }
		>;
		expect(create.post.responses["413"]).toBeDefined();
		expect(create.post.responses["415"]).toBeDefined();
		expect(availability.put.responses["413"]).toBeDefined();
		expect(availability.put.responses["415"]).toBeDefined();
		expect(availability.post.responses["413"]).toBeDefined();
		expect(availability.post.responses["415"]).toBeDefined();
	});
});

describe("openapi drift guard", () => {
	it("matches committed scripts/openapi.json", () => {
		const spec = getOpenApiSpec("https://example.com");
		const committed = readFileSync(
			join(process.cwd(), "scripts", "openapi.json"),
			"utf8",
		);
		expect(`${JSON.stringify(spec, null, 2)}\n`).toBe(committed);
	});

	it("keeps api-schema.d.ts byte-identical to the generated output", async () => {
		const spec = getOpenApiSpec("https://example.com");
		const dts = readFileSync(
			join(process.cwd(), "src", "lib", "api-schema.d.ts"),
			"utf8",
		);
		expect(
			COMMENT_HEADER +
				astToString(
					await openapiTS(spec as unknown as Parameters<typeof openapiTS>[0]),
				),
		).toBe(dts);
	});

	it("uses unique operationIds across the spec", () => {
		const spec = getOpenApiSpec("https://example.com");
		const ops: string[] = [];
		for (const path of Object.values(spec.paths)) {
			for (const method of Object.values(
				path as Record<string, { operationId?: string }>,
			)) {
				if (method?.operationId) ops.push(method.operationId);
			}
		}
		expect(ops.length).toBeGreaterThan(0);
		expect(new Set(ops).size).toBe(ops.length);
	});
});
