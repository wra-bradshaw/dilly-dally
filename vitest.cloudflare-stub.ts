export class DurableObject<Env = unknown> {
	protected ctx: DurableObjectState;
	protected env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		this.ctx = ctx;
		this.env = env;
	}
}

export const env: Record<string, unknown> = {};
