import { beforeEach, describe, expect, it } from "vitest";
import { CHAT_QUOTAS, checkChatQuota, clientIp } from "@/lib/chat/quota";
import { MemoryStore } from "./helpers/memory-store";

const IP = "203.0.113.7";

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

async function spend(ip: string, times: number) {
  for (let i = 0; i < times; i++) await checkChatQuota(store, ip);
}

/** Uses up `times` messages slowly enough to stay under the per-minute limit. */
async function spendSlowly(ip: string, times: number) {
  for (let i = 0; i < times; i++) {
    await checkChatQuota(store, ip);
    store.nowMs += 61_000;
  }
}

describe("checkChatQuota", () => {
  it("allows an IP up to the per-minute limit", async () => {
    for (let i = 0; i < CHAT_QUOTAS.perIpMinute.limit; i++) {
      expect(await checkChatQuota(store, IP)).toEqual({ allowed: true });
    }
  });

  it("blocks an IP over the per-minute limit and says when to come back", async () => {
    await spend(IP, CHAT_QUOTAS.perIpMinute.limit);
    store.nowMs += 20_000;

    expect(await checkChatQuota(store, IP)).toEqual({ allowed: false, window: "minute", retryAfterSeconds: 40 });
  });

  it("lets the IP back in once the minute is over", async () => {
    await spend(IP, CHAT_QUOTAS.perIpMinute.limit + 1);
    store.nowMs += 60_000;

    expect(await checkChatQuota(store, IP)).toEqual({ allowed: true });
  });

  it("counts each IP separately", async () => {
    await spend(IP, CHAT_QUOTAS.perIpMinute.limit + 1);

    expect(await checkChatQuota(store, "203.0.113.8")).toEqual({ allowed: true });
  });

  it("treats a whole IPv6 /64 as one client", async () => {
    await spend("2001:db8:1:2:aaaa::1", CHAT_QUOTAS.perIpMinute.limit);

    expect(await checkChatQuota(store, "2001:db8:1:2:bbbb::2")).toMatchObject({ allowed: false });
    expect(await checkChatQuota(store, "2001:db8:1:3::1")).toEqual({ allowed: true });
  });

  it("blocks an IP over the daily limit even when it goes slowly", async () => {
    await spendSlowly(IP, CHAT_QUOTAS.perIpDay.limit);

    expect(await checkChatQuota(store, IP)).toMatchObject({ allowed: false, window: "day" });
  });

  it("stops everyone once the shared daily budget is gone", async () => {
    const perIp = CHAT_QUOTAS.perIpDay.limit;
    const ips = Math.ceil(CHAT_QUOTAS.allDay.limit / perIp);
    for (let i = 0; i < ips; i++) await spendSlowly(`198.51.100.${i}`, perIp);

    expect(await checkChatQuota(store, IP)).toMatchObject({ allowed: false, window: "day" });
  });

  it("doesn't charge the shared budget for requests it blocked", async () => {
    await spend(IP, CHAT_QUOTAS.allDay.limit * 2);

    expect(await checkChatQuota(store, "203.0.113.8")).toEqual({ allowed: true });
  });

  it("clears expired counters when the shared budget restarts", async () => {
    await spend(IP, 1);
    store.nowMs += 86_400_000;

    await spend("203.0.113.8", 1);

    expect([...store.hitCounts.keys()].some((key) => key.includes(IP))).toBe(false);
  });
});

describe("clientIp", () => {
  it("prefers the address the platform set", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" });

    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("takes the first entry of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("puts requests with no address in one shared bucket", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
