import { createClient } from 'redis';
import { getRuntimeConfig } from '../../config/env';
import type { CatalogCache } from '../../modules/products/products.service';

type RedisClient = ReturnType<typeof createClient>;

class RedisCatalogCache implements CatalogCache {
  private connection?: Promise<RedisClient>;
  private retryAfter = 0;
  private warned = false;

  constructor(private readonly url: string) {}

  private client(): Promise<RedisClient> {
    if (!this.connection) {
      const client = createClient({
        url: this.url,
        socket: { connectTimeout: 1_000, reconnectStrategy: false },
      });
      client.on('error', () => {
        /* A failed cache request falls back to PostgreSQL. */
      });
      this.connection = client.connect().then(() => client);
    }
    return this.connection;
  }

  private unavailable(): void {
    this.connection = undefined;
    this.retryAfter = Date.now() + 30_000;
    if (!this.warned) console.warn('Catalog Redis unavailable; reading from PostgreSQL');
    this.warned = true;
  }

  async get(key: string): Promise<string | null> {
    if (Date.now() < this.retryAfter) return null;
    try {
      const value = await (await this.client()).get(key);
      this.warned = false;
      return value;
    } catch {
      this.unavailable();
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (Date.now() < this.retryAfter) return;
    try {
      await (await this.client()).set(key, value, { EX: ttlSeconds });
      this.warned = false;
    } catch {
      this.unavailable();
    }
  }
}

let sharedCache: CatalogCache | undefined;

export function createRedisCatalogCache(url: string): CatalogCache {
  return new RedisCatalogCache(url);
}

export function getCatalogCache(): CatalogCache {
  if (!sharedCache) {
    const url = getRuntimeConfig().REDIS_URL;
    sharedCache = url
      ? createRedisCatalogCache(url)
      : { get: async () => null, set: async () => {} };
  }
  return sharedCache;
}
