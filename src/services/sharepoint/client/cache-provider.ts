/** Future caching layer — no-op implementation today. */
export interface ICacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(keyOrPattern: string): Promise<void>;
}

export class NoOpCacheProvider implements ICacheProvider {
  async get<T>(): Promise<T | undefined> {
    return undefined;
  }

  async set(): Promise<void> {
    return;
  }

  async invalidate(): Promise<void> {
    return;
  }
}

export class MemoryCacheProvider implements ICacheProvider {
  private readonly store = new Map<
    string,
    { value: unknown; expiresAt?: number }
  >();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async invalidate(keyOrPattern: string): Promise<void> {
    if (!keyOrPattern.includes("*")) {
      this.store.delete(keyOrPattern);
      return;
    }

    const prefix = keyOrPattern.replace("*", "");
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}
