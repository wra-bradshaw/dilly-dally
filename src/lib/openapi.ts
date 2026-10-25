import { docsResponse, originOf } from "./api-errors";
import { buildOpenApiDocument, type OpenApiSpec } from "./openapi-document";

export type { OpenApiSpec } from "./openapi-document";

export function serializeSpec(spec: OpenApiSpec): string {
	return `${JSON.stringify(spec, null, 2)}\n`;
}

export function openApiResponse(request: Request): Response {
	return docsResponse(
		JSON.stringify(getOpenApiSpec(originOf(request))),
		"application/json; charset=utf-8",
	);
}

export function getOpenApiSpec(origin: string): OpenApiSpec {
	return buildOpenApiDocument(origin);
}
