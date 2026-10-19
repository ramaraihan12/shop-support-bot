import { asc, cosineDistance, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  conversations,
  customers,
  messages,
  orderItems,
  orders,
  policyChunks,
  products,
  tickets,
} from "@/lib/db/schema";
import type { OrderRecord } from "@/lib/orders";
import { ticketCode, type SupportStore } from "./types";

// Words customers type that never appear in product names.
const SEARCH_STOPWORDS = new Set(["kopi", "coffee", "biji", "beans", "bean", "yang", "ada", "stok", "stock"]);

export function createDbStore(db: Database): SupportStore {
  return {
    async getOrCreateConversation(channel, externalId) {
      const [row] = await db
        .insert(conversations)
        .values({ channel, externalId })
        .onConflictDoUpdate({
          target: [conversations.channel, conversations.externalId],
          set: { updatedAt: sql`now()` },
        })
        .returning();
      if (!row) throw new Error("Conversation upsert returned nothing");
      return row;
    },

    async getRecentMessages(conversationId, limit) {
      const rows = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(limit);
      return rows.reverse();
    },

    async saveMessage(conversationId, message) {
      await db.insert(messages).values({
        conversationId,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls?.length ? message.toolCalls : null,
      });
      await db
        .update(conversations)
        .set({ updatedAt: sql`now()` })
        .where(eq(conversations.id, conversationId));
    },

    async markHandoff(conversationId) {
      await db
        .update(conversations)
        .set({ status: "handoff", updatedAt: sql`now()` })
        .where(eq(conversations.id, conversationId));
    },

    async recordFailedLookup(conversationId) {
      const [row] = await db
        .update(conversations)
        .set({ failedLookups: sql`${conversations.failedLookups} + 1` })
        .where(eq(conversations.id, conversationId))
        .returning({ failedLookups: conversations.failedLookups });
      return row?.failedLookups ?? 0;
    },

    async findOrder(orderNumber) {
      const [orderRows, items] = await Promise.all([
        db
          .select({
            number: orders.number,
            status: orders.status,
            shippingCity: orders.shippingCity,
            courier: orders.courier,
            trackingNumber: orders.trackingNumber,
            totalIdr: orders.totalIdr,
            placedAt: orders.placedAt,
            shippedAt: orders.shippedAt,
            deliveredAt: orders.deliveredAt,
            customer: { name: customers.name, email: customers.email, phone: customers.phone },
          })
          .from(orders)
          .innerJoin(customers, eq(orders.customerId, customers.id))
          .where(eq(orders.number, orderNumber))
          .limit(1),
        db
          .select({ name: products.name, quantity: orderItems.quantity })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .innerJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orders.number, orderNumber))
          .orderBy(asc(orderItems.id)),
      ]);

      const order = orderRows[0];
      return order ? ({ ...order, items } satisfies OrderRecord) : null;
    },

    async searchProducts(query, limit) {
      const terms = (query ?? "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}-]+/u)
        .filter((t) => t.length >= 3 && !SEARCH_STOPWORDS.has(t));

      const columns = {
        sku: products.sku,
        name: products.name,
        origin: products.origin,
        roast: products.roast,
        process: products.process,
        tastingNotes: products.tastingNotes,
        weightGrams: products.weightGrams,
        priceIdr: products.priceIdr,
        stock: products.stock,
      };

      if (terms.length === 0) {
        return db.select(columns).from(products).orderBy(asc(products.name)).limit(limit);
      }

      const conditions: SQL[] = terms.flatMap((term) => {
        const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
        return [ilike(products.name, pattern), ilike(products.origin, pattern), ilike(products.sku, pattern)];
      });

      return db
        .select(columns)
        .from(products)
        .where(or(...conditions))
        .orderBy(asc(products.name))
        .limit(limit);
    },

    async searchPolicies(embedding, limit) {
      const distance = cosineDistance(policyChunks.embedding, embedding);
      return db
        .select({
          source: policyChunks.source,
          heading: policyChunks.heading,
          content: policyChunks.content,
          similarity: sql<number>`1 - (${distance})`.mapWith(Number),
        })
        .from(policyChunks)
        .orderBy(distance)
        .limit(limit);
    },

    async createTicket(ticket) {
      const [row] = await db
        .insert(tickets)
        .values({
          conversationId: ticket.conversationId,
          category: ticket.category,
          priority: ticket.priority,
          subject: ticket.subject,
          details: ticket.details,
          contact: ticket.contact ?? null,
          orderNumber: ticket.orderNumber ?? null,
        })
        .returning({ id: tickets.id });
      if (!row) throw new Error("Ticket insert returned nothing");
      return { id: row.id, code: ticketCode(row.id) };
    },
  };
}
