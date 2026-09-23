import { env } from "cloudflare:workers";

export function allowNamespace() {
	return {
		getByName: (_key: string) => ({
			check: async () => ({
				allowed: true,
				remaining: 1,
				resetMs: Date.now() + 1000,
			}),
		}),
	};
}

export function denyNamespace() {
	return {
		getByName: (_key: string) => ({
			check: async () => ({
				allowed: false,
				remaining: 0,
				resetMs: Date.now() + 1000,
			}),
		}),
	};
}

export function stubRateLimiter(namespace: unknown) {
	(env as unknown as Record<string, unknown>).RATE_LIMITER = namespace;
}
