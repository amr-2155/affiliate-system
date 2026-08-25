/**
 * Minimal ambient types for Node's built-in SQLite module (node:sqlite),
 * which ships experimental in Node 22 but has no @types/node entry yet.
 * Only the surface used by the migration/verification scripts is declared.
 */
declare module "node:sqlite" {
  export interface StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
    get(...params: unknown[]): Record<string, unknown> | undefined
    all(...params: unknown[]): Record<string, unknown>[]
  }
  export interface DatabaseSyncOptions {
    open?: boolean
    readOnly?: boolean
  }
  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions)
    prepare(sql: string): StatementSync
    exec(sql: string): void
    close(): void
  }
}
