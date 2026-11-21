import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LOOKUPS_PER_MESSAGE, MAX_LOOKUPS_PER_ORDER, createSupportTools } from "@/lib/chat/tools";
import { MemoryStore } from "./helpers/memory-store";

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

async function lookup(orderNumber: string, conversationId: string) {
  const conversation = await store.getOrCreateConversation("web", conversationId);
  const tools = createSupportTools({ store, conversation, embed: async () => [0], lastUserMessage: "" });
  const result = await tools.lookupOrder.execute!(
    { orderNumber, email: "guess@example.com" },
    { toolCallId: "t", messages: [], context: {} },
  );
  return result as { status: string; message?: string };
}

describe("lookupOrder per-order lock", () => {
  it("locks an order after the limit even when every call uses a fresh conversation", async () => {
    for (let i = 0; i < MAX_LOOKUPS_PER_ORDER; i++) {
      expect((await lookup("KN-10234", `fresh-${i}`)).status).toBe("not_found");
    }
    const locked = await lookup("KN-10234", "fresh-last");
    expect(locked.status).toBe("locked");
    expect(locked.message).toBe(
      "This order has been looked up too many times today. Offer to hand the customer over to the team.",
    );
    expect(store.orderLookups).toHaveLength(MAX_LOOKUPS_PER_ORDER);
  });

  it("lets at most the limit through when calls run in parallel", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => lookup("KN-10234", "same")));
    expect(store.orderLookups.length).toBeLessThanOrEqual(MAX_LOOKUPS_PER_ORDER);
    expect(results.filter((r) => r.status === "locked").length).toBeGreaterThanOrEqual(2);
  });

  it("does not affect other order numbers", async () => {
    for (let i = 0; i < MAX_LOOKUPS_PER_ORDER + 1; i++) await lookup("KN-10234", `c-${i}`);
    expect((await lookup("KN-10235", "other")).status).toBe("not_found");
  });
});

describe("lookupOrder per-message cap", () => {
  const orders = ["KN-10001", "KN-10002", "KN-10003", "KN-10004", "KN-10005"];

  async function tools() {
    const conversation = await store.getOrCreateConversation("web", "one-chat");
    return createSupportTools({ store, conversation, embed: async () => [0], lastUserMessage: "" });
  }

  function run(t: Awaited<ReturnType<typeof tools>>, orderNumber: string) {
    return t.lookupOrder.execute!(
      { orderNumber, email: "guess@example.com" },
      { toolCallId: "t", messages: [], context: {} },
    ) as Promise<{ status: string; message?: string }>;
  }

  it("lets only two parallel lookups through in one message", async () => {
    const t = await tools();
    const results = await Promise.all(orders.map((o) => run(t, o)));
    expect(store.orderLookups).toHaveLength(MAX_LOOKUPS_PER_MESSAGE);
    const refused = results.filter((r) => r.status === "locked");
    expect(refused).toHaveLength(3);
    for (const r of refused) {
      expect(r.message).toBe(
        "Only two orders can be checked per message. Ask the customer to send the next order number in a new message.",
      );
    }
    // Refused calls did not touch the per-order counters.
    expect(store.hitCounts.has("lookup:KN-10005")).toBe(false);
  });

  it("allows lookups again in the next message", async () => {
    const first = await tools();
    await Promise.all(orders.map((o) => run(first, o)));
    const next = await tools();
    expect((await run(next, "KN-10006")).status).toBe("not_found");
  });
});
