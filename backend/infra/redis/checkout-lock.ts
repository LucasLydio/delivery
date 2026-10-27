import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { getRuntimeConfig } from '../../config/env';
import { ServiceUnavailableException } from '../../shared/exceptions';

export type ReleaseCheckoutLock = () => Promise<void>;
export interface CheckoutLock {
  acquire(cartId: string, ttlMs: number): Promise<ReleaseCheckoutLock | null>;
}

class RedisCheckoutLock implements CheckoutLock {
  private connection?: Promise<ReturnType<typeof createClient>>;
  constructor(
    private readonly url: string,
    private readonly namespace: string,
  ) {}

  private client(): Promise<ReturnType<typeof createClient>> {
    if (!this.connection) {
      const client = createClient({
        url: this.url,
        socket: { connectTimeout: 1_000, reconnectStrategy: false },
      });
      client.on('error', () => {});
      this.connection = client.connect().then(() => client);
    }
    return this.connection;
  }

  async acquire(cartId: string, ttlMs: number): Promise<ReleaseCheckoutLock | null> {
    const key = `${this.namespace}:checkout:cart:${cartId}`;
    const token = randomUUID();
    try {
      const client = await this.client();
      const result = await client.set(key, token, { NX: true, PX: ttlMs });
      if (result !== 'OK') return null;
      return async () => {
        await client
          .eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            { keys: [key], arguments: [token] },
          )
          .catch(() => undefined);
      };
    } catch {
      this.connection = undefined;
      throw new ServiceUnavailableException('Checkout lock is unavailable');
    }
  }
}

class MissingCheckoutLock implements CheckoutLock {
  async acquire(): Promise<never> {
    throw new ServiceUnavailableException('Redis is required for checkout');
  }
}

let sharedLock: CheckoutLock | undefined;
export function getCheckoutLock(): CheckoutLock {
  if (!sharedLock) {
    const config = getRuntimeConfig();
    sharedLock = config.REDIS_URL
      ? new RedisCheckoutLock(config.REDIS_URL, config.CACHE_NAMESPACE)
      : new MissingCheckoutLock();
  }
  return sharedLock;
}
