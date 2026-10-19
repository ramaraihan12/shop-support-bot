import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit inside the window, then blocks", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);

    now = 10_000;
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 50 });
  });

  it("frees up again as old hits leave the window", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => now });
    limiter.check("a");
    now = 30_000;
    limiter.check("a");

    now = 59_000;
    expect(limiter.check("a").allowed).toBe(false);
    now = 60_000;
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("counts each session separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => 0 });
    expect(limiter.check("web:one").allowed).toBe(true);
    expect(limiter.check("web:two").allowed).toBe(true);
    expect(limiter.check("web:one").allowed).toBe(false);
  });
});
