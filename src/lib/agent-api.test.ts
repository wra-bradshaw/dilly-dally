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

	it("documents weekly mode with weekday slots", () => {
		const spec = getOpenApiSpec("https://example.com");
		const schemas = spec.components?.schemas as Record<
			string,
			{ pattern?: string; properties?: Record<string, unknown> }
		>;
		expect(schemas.EventMode).toBeDefined();
		expect(schemas.WeeklySlotId?.pattern).toContain("MON");
		expect(schemas.SlotId?.pattern).toContain("MON");
		expect(schemas.CreateEventRequest?.properties?.weekdays).toBeDefined();
		expect(schemas.Event?.properties?.mode).toBeDefined();
	});
});

describe("agent guide", () => {
	it("contains curl flows for create and availability", () => {
		expect(AGENT_GUIDE_MARKDOWN).toContain("curl");
		expect(AGENT_GUIDE_MARKDOWN).toContain("/api/events");
		expect(AGENT_GUIDE_MARKDOWN).toContain("availability");
		expect(AGENT_GUIDE_MARKDOWN).toContain("/api/openapi.json");
	});

	it("documents the weekly curl flow", () => {
		expect(AGENT_GUIDE_MARKDOWN).toContain('"mode": "weekly"');
		expect(AGENT_GUIDE_MARKDOWN).toContain("MON-09:15");
	});
});
