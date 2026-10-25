import { securityHeaders } from "./api-errors";

export function jsonRpcError(
	code: number,
	message: string,
	id: unknown,
	status: number,
	extraHeaders?: Record<string, string>,
): Response {
	const headers: Record<string, string> = {
		...securityHeaders(),
		"Content-Type": "application/json",
		...extraHeaders,
	};
	return Response.json(
		{
			error: { code, message },
			id: id ?? null,
			jsonrpc: "2.0",
		},
		{ headers, status },
	);
}
