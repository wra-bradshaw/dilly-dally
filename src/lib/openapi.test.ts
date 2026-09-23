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
});
