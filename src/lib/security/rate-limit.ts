type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

const memoryStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, limit = 25, windowMs = 60_000) {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.expiresAt < now) {
    memoryStore.set(key, {
      count: 1,
      expiresAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: limit - 1,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.expiresAt - now,
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: limit - existing.count,
  };
}

export function createRateLimitKey(parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(':');
}
