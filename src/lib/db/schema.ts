import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const EMBEDDING_DIMENSIONS = 1024;

export const products = pgTable("products", {
  id: serial().primaryKey(),
  sku: varchar({ length: 32 }).notNull().unique(),
  name: text().notNull(),
  origin: text().notNull(),
  roast: text().notNull(),
  process: text().notNull(),
  tastingNotes: text().notNull(),
  weightGrams: integer().notNull(),
  priceIdr: integer().notNull(),
  stock: integer().notNull(),
});

export const customers = pgTable("customers", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  // Stored normalized, e.g. 6281234567890
  phone: text().notNull(),
});

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const orders = pgTable("orders", {
  id: serial().primaryKey(),
  number: varchar({ length: 16 }).notNull().unique(),
  customerId: integer()
    .notNull()
    .references(() => customers.id),
  status: orderStatus().notNull(),
  shippingCity: text().notNull(),
  courier: text(),
  trackingNumber: text(),
  totalIdr: integer().notNull(),
  placedAt: timestamp({ withTimezone: true }).notNull(),
  shippedAt: timestamp({ withTimezone: true }),
  deliveredAt: timestamp({ withTimezone: true }),
});

export const orderItems = pgTable("order_items", {
  id: serial().primaryKey(),
  orderId: integer()
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer()
    .notNull()
    .references(() => products.id),
  quantity: integer().notNull(),
  unitPriceIdr: integer().notNull(),
});

export const policyChunks = pgTable(
  "policy_chunks",
  {
    id: serial().primaryKey(),
    source: text().notNull(),
    heading: text().notNull(),
    content: text().notNull(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (t) => [index("policy_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

export const channel = pgEnum("channel", ["web", "telegram"]);
export const conversationStatus = pgEnum("conversation_status", ["bot", "handoff"]);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    channel: channel().notNull(),
    externalId: text().notNull(),
    status: conversationStatus().notNull().default("bot"),
    failedLookups: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("conversations_channel_external_id_idx").on(t.channel, t.externalId)],
);

export const messageRole = pgEnum("message_role", ["user", "assistant"]);

export const messages = pgTable(
  "messages",
  {
    id: serial().primaryKey(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole().notNull(),
    content: text().notNull(),
    toolCalls: jsonb().$type<string[]>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_id_idx").on(t.conversationId, t.createdAt)],
);

export const ticketCategory = pgEnum("ticket_category", [
  "order",
  "shipping",
  "product",
  "payment",
  "handoff",
  "other",
]);
export const ticketPriority = pgEnum("ticket_priority", ["normal", "high"]);
export const ticketStatus = pgEnum("ticket_status", ["open", "closed"]);

export const tickets = pgTable("tickets", {
  id: serial().primaryKey(),
  conversationId: uuid().references(() => conversations.id, { onDelete: "set null" }),
  category: ticketCategory().notNull(),
  priority: ticketPriority().notNull().default("normal"),
  status: ticketStatus().notNull().default("open"),
  subject: text().notNull(),
  details: text().notNull(),
  contact: text(),
  orderNumber: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
