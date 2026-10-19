import type { Redis } from "@upstash/redis";

export type Store = {
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
};

type MemEntry = { value: unknown; expiresAtMs: number };

function getMemMap(): Map<string, MemEntry> {
  const g = globalThis as any;
  if (!g.__capgent_mem_store) g.__capgent_mem_store = new Map<string, MemEntry>();
  return g.__capgent_mem_store as Map<string, MemEntry>;
}

export function createInMemoryStore(): Store {
  return {
    async getJson<T>(key: string) {
      const map = getMemMap();
      const entry = map.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAtMs) {
        map.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async setJson(key: string, value: unknown, ttlSeconds: number) {
      const map = getMemMap();
      map.set(key, { value, expiresAtMs: Date.now() + ttlSeconds * 1000 });
    },
    async del(key: string) {
      getMemMap().delete(key);
    }
  };
}

export function createRedisStore(redis: Redis): Store {
  return {
    async getJson<T>(key: string) {
      const raw = (await redis.get<any>(key)) ?? null;
      if (!raw) return null;
      if (typeof raw === "string") return JSON.parse(raw) as T;
      return raw as T;
    },
    async setJson(key: string, value: unknown, ttlSeconds: number) {
      // Upstash may JSON-encode/decode automatically; store as object.
      await redis.set(key, value as any, { ex: ttlSeconds });
    },
    async del(key: string) {
      await redis.del(key);
    }
  };
}

