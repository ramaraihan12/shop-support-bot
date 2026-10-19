export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  check(key: string): RateLimitResult;
};

/**
 * Sliding window kept in memory. Good enough for one instance; several
 * instances would each keep their own count, so this would move to Postgres
 * or Redis behind a load balancer.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const { limit, windowMs, now = Date.now } = options;
  const hits = new Map<string, number[]>();
  let checksSinceSweep = 0;

  const sweep = (time: number) => {
    for (const [key, stamps] of hits) {
      if (stamps.every((t) => time - t >= windowMs)) hits.delete(key);
    }
  };

  return {
    check(key) {
      const time = now();
      if (++checksSinceSweep >= 500) {
        checksSinceSweep = 0;
        sweep(time);
      }

      const recent = (hits.get(key) ?? []).filter((t) => time - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? time;
        return { allowed: false, retryAfterSeconds: Math.ceil((oldest + windowMs - time) / 1000) };
      }

      recent.push(time);
      hits.set(key, recent);
      return { allowed: true };
    },
  };
}
