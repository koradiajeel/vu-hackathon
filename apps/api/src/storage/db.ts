import type { Env } from '../config';
import { localSql } from './local-db';

/** All SQL now runs against the local embedded database (see local-db.ts). */
export function createDb(_env: Env) {
  return localSql;
}
