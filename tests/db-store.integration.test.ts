import { eq, inArray, like } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/lib/db";
import { conversations, EMBEDDING_DIMENSIONS, policyChunks, tickets } from "@/lib/db/schema";
import { seedShop } from "@/lib/db/seed";
import { createDbStore } from "@/lib/store/db-store";
import type { SupportStore } from "@/lib/store/types";

// Runs against a real Postgres with pgvector, e.g.
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shop_support_test pnpm test
// It migrates and reseeds the shop tables, so don't point it at data you care about.
const url = process.env.TEST_DATABASE_URL;

const TEST_SOURCE = "integration-test.md";
const EXTERNAL_PREFIX = "itest-";

function unitVector(index: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

describe.skipIf(!url)("db store against postgres", () => {
  let db: Database;
  let close: () => Promise<void>;
  let store: SupportStore;

  beforeAll(async () => {
    const created = createDb(url!);
    db = created.db;
    close = () => created.client.end();
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedShop(db);
    store = createDbStore(db);
  });

  afterAll(async () => {
    const ids = db
      .select({ id: conversations.id })
      .from(conversations)
      .where(like(conversations.externalId, `${EXTERNAL_PREFIX}%`));
    await db.delete(tickets).where(inArray(tickets.conversationId, ids));
    await db.delete(conversations).where(like(conversations.externalId, `${EXTERNAL_PREFIX}%`));
    await db.delete(policyChunks).where(eq(policyChunks.source, TEST_SOURCE));
    await close();
  });

  it("loads an order with its customer and line items", async () => {
    const order = await store.findOrder("KN-10234");

    expect(order).toMatchObject({
      number: "KN-10234",
      status: "shipped",
      courier: "SiCepat REG",
      customer: { email: "bagus.pratama@example.com", phone: "6281300002202" },
      items: [
        { name: "Toraja Sapan", quantity: 1 },
        { name: "Flores Bajawa Honey", quantity: 1 },
      ],
    });
    // 120.000 + 115.000 + 22.000 shipping
    expect(order?.totalIdr).toBe(257_000);
  });

  it("returns null for an order that doesn't exist", async () => {
    expect(await store.findOrder("KN-00001")).toBeNull();
  });

  it("finds products by origin and skips filler words", async () => {
    const found = await store.searchProducts("kopi toraja", 10);
    expect(found.map((p) => p.sku)).toEqual(["TORAJA-SP-200"]);
  });

  it("treats LIKE wildcards like any other punctuation", async () => {
    const all = await store.searchProducts(undefined, 50);
    expect(await store.searchProducts("%_%", 50)).toEqual(all);
  });

  it("lists the catalog when there is no query", async () => {
    expect(await store.searchProducts(undefined, 50)).toHaveLength(10);
  });

  it("keeps one conversation per channel and id and counts failed lookups", async () => {
    const first = await store.getOrCreateConversation("web", `${EXTERNAL_PREFIX}a`);
    const again = await store.getOrCreateConversation("web", `${EXTERNAL_PREFIX}a`);
    const telegram = await store.getOrCreateConversation("telegram", `${EXTERNAL_PREFIX}a`);

    expect(again.id).toBe(first.id);
    expect(telegram.id).not.toBe(first.id);
    expect(await store.recordFailedLookup(first.id)).toBe(1);
    expect(await store.recordFailedLookup(first.id)).toBe(2);
  });

  it("returns recent messages oldest first", async () => {
    const conversation = await store.getOrCreateConversation("web", `${EXTERNAL_PREFIX}b`);
    for (const content of ["satu", "dua", "tiga"]) {
      await store.saveMessage(conversation.id, { role: "user", content });
    }

    const recent = await store.getRecentMessages(conversation.id, 2);
    expect(recent.map((m) => m.content)).toEqual(["dua", "tiga"]);
  });

  it("ranks policy chunks by cosine similarity", async () => {
    await db.insert(policyChunks).values([
      { source: TEST_SOURCE, heading: "Test > A", content: "chunk a", embedding: unitVector(0) },
      { source: TEST_SOURCE, heading: "Test > B", content: "chunk b", embedding: unitVector(1) },
    ]);

    const [best] = await store.searchPolicies(unitVector(1), 3);
    expect(best).toMatchObject({ heading: "Test > B" });
    expect(best?.similarity).toBeCloseTo(1, 5);
  });

  it("creates tickets with readable codes", async () => {
    const conversation = await store.getOrCreateConversation("web", `${EXTERNAL_PREFIX}c`);
    const ticket = await store.createTicket({
      conversationId: conversation.id,
      category: "shipping",
      priority: "normal",
      subject: "Paket belum sampai",
      details: "Sudah 10 hari.",
      contact: "rina.wulandari@example.com",
    });

    expect(ticket.code).toMatch(/^TK-\d{4,}$/);
  });
});
