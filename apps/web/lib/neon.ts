import { localSql } from "../../api/src/storage/local-db";

/**
 * Local embedded Postgres (PGlite) — no cloud database needed.
 * Same tagged-template API as the old Neon client.
 */
export const sql = localSql;
