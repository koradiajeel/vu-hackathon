import type { Env } from "../config";
import { forceInMemory } from "../config";
import { canUseRedis, createRedis } from "../storage/redis";
import { createInMemoryStore, createRedisStore, type Store } from "../storage/store";

export type GuestbookEntry = {
  id: string;
  agent_id: string;
  agent_name: string;
  framework?: string;
  model?: string;
  owner_org?: string;
  message: string;
  solve_ms: number;
  created_at: string;
};

const GUESTBOOK_KEY = "guestbook:entries";
const GUESTBOOK_TTL_SECONDS = 60 * 60 * 24 * 365;
const GUESTBOOK_MAX_ENTRIES = 500;

function getStore(env: Env): Store {
  return !forceInMemory(env) && canUseRedis(env) ? createRedisStore(createRedis(env)) : createInMemoryStore();
}

export async function addGuestbookEntry(env: Env, entry: GuestbookEntry): Promise<GuestbookEntry> {
  const store = getStore(env);
  const existing = (await store.getJson<GuestbookEntry[]>(GUESTBOOK_KEY)) ?? [];
  const next = [entry, ...existing].slice(0, GUESTBOOK_MAX_ENTRIES);
  await store.setJson(GUESTBOOK_KEY, next, GUESTBOOK_TTL_SECONDS);
  return entry;
}

export async function getGuestbookEntries(env: Env): Promise<GuestbookEntry[]> {
  const store = getStore(env);
  return (await store.getJson<GuestbookEntry[]>(GUESTBOOK_KEY)) ?? [];
}

export async function clearGuestbook(env: Env): Promise<void> {
  const store = getStore(env);
  await store.del(GUESTBOOK_KEY);
}
