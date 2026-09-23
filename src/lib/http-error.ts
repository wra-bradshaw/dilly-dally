export class HttpError extends Error {
	status: number;
	code: string;
	fields?: Record<string, string[]>;
	retryAfter?: number;

	constructor(
		status: number,
		code: string,
		message: string,
		fields?: Record<string, string[]>,
		retryAfter?: number,
	) {
		super(message);
		this.status = status;
		this.code = code;
		this.fields = fields;
		this.retryAfter = retryAfter;
	}
}
