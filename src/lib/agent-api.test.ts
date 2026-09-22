import { describe, expect, it } from "vitest";
import { AGENT_GUIDE_MARKDOWN } from "./agent-guide";
import { getOpenApiSpec } from "./openapi";

describe("openapi spec", () => {
	it("has required paths and schemas", () => {
		const spec = getOpenApiSpec("https://example.com");
		expect(spec.openapi).toMatch(/^3\./);
		expect(spec.paths["/api/events"]).toBeDefined();
		expect(spec.paths["/api/events/{id}"]).toBeDefined();
		expect(spec.paths["/api/events/{id}/availability"]).toBeDefined();
		expect(spec.components?.schemas?.Event).toBeDefined();
		expect(spec.components?.schemas?.CreateEventRequest).toBeDefined();
	});

	it("slot pattern only allows quarter hours", () => {
		const spec = getOpenApiSpec("https://example.com");
		const schemas = spec.components?.schemas as Record<
			string,
			{ pattern?: string }
		>;
		expect(schemas.SlotId?.pattern).toContain("00|15|30|45");
	});
});

describe("agent guide", () => {
	it("contains curl flows for create and availability", () => {
		expect(AGENT_GUIDE_MARKDOWN).toContain("curl");
		expect(AGENT_GUIDE_MARKDOWN).toContain("/api/events");
		expect(AGENT_GUIDE_MARKDOWN).toContain("availability");
		expect(AGENT_GUIDE_MARKDOWN).toContain("/api/openapi.json");
	});
});
