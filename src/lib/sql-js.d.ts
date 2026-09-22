declare module "sql.js" {
	export interface SqlJsStatic {
		Database: new (data?: Uint8Array) => SqlJsDatabase;
	}

	export interface SqlJsDatabase {
		exec(sql: string): void;
		close(): void;
	}

	const initSqlJs: (config?: {
		wasmBinary?: Uint8Array;
	}) => Promise<SqlJsStatic>;
	export default initSqlJs;
}
