import type { CountedHit, SupportStore } from "@/lib/store/types";

// A message of MAX_MESSAGE_CHARS plus the JSON around it fits with room to spare.
export const MAX_BODY_BYTES = 8 * 1024;

// One message can cost several model calls, so these stay small. The per-IP
// limits are for a person trying the bot. The total is what holds when someone
// spreads requests over many addresses.
export const CHAT_QUOTAS = {
  perIpMinute: { limit: 6, windowSeconds: 60 },
  perIpDay: { limit: 30, windowSeconds: 86_400 },
  allDay: { limit: 100, windowSeconds: 86_400 },
};

export type QuotaResult =
  | { allowed: true }
  | { allowed: false; window: "minute" | "day"; retryAfterSeconds: number };

const blocked = (window: "minute" | "day", hit: CountedHit): QuotaResult => ({
  allowed: false,
  window,
  retryAfterSeconds: hit.retryAfterSeconds,
});

/**
 * Counts one chat message against the limits. The counters live in Postgres
 * because serverless instances share no memory.
 */
export async function checkChatQuota(
  store: Pick<SupportStore, "countHit" | "deleteExpiredHits">,
  ip: string,
): Promise<QuotaResult> {
  const { perIpMinute, perIpDay, allDay } = CHAT_QUOTAS;
  const client = clientBucket(ip);

  const minute = await store.countHit(`ip:${client}:minute`, perIpMinute.windowSeconds);
  if (minute.hits > perIpMinute.limit) return blocked("minute", minute);

  const day = await store.countHit(`ip:${client}:day`, perIpDay.windowSeconds);
  if (day.hits > perIpDay.limit) return blocked("day", day);

  // Counted last, so one client hammering the route can't spend the budget
  // everyone else shares.
  const total = await store.countHit("all:day", allDay.windowSeconds);
  if (total.hits === 1) await store.deleteExpiredHits();
  if (total.hits > allDay.limit) return blocked("day", total);

  return { allowed: true };
}

/**
 * Vercel overwrites these headers, so a client can't forge them there. Behind
 * anything else the proxy in front has to do the same.
 */
export function clientIp(headers: Headers): string {
  return (headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim()) || "unknown";
}

/** One IPv6 customer usually holds a whole /64, so that's the unit to count. */
function clientBucket(ip: string): string {
  if (!ip.includes(":") || ip.includes(".")) return ip;

  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const left = head.split(":").filter(Boolean);
  const right = tail.split(":").filter(Boolean);
  const zeros = Array.from({ length: Math.max(0, 8 - left.length - right.length) }, () => "0");
  return [...left, ...zeros, ...right].slice(0, 4).join(":");
}
