import { beforeEach, describe, expect, it } from "vitest";
import { MAX_LOOKUPS_PER_ORDER, createSupportTools } from "@/lib/chat/tools";
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
  return result as { status: string };
}

describe("lookupOrder per-order lock", () => {
  it("locks an order after the limit even when every call uses a fresh conversation", async () => {
    for (let i = 0; i < MAX_LOOKUPS_PER_ORDER; i++) {
      expect((await lookup("KN-10234", `fresh-${i}`)).status).toBe("not_found");
    }
    expect((await lookup("KN-10234", "fresh-last")).status).toBe("locked");
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
