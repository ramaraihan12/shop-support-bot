import type { OrderRecord } from "@/lib/orders";

export type Channel = "web" | "telegram";
export type ConversationStatus = "bot" | "handoff";

export type Conversation = {
  id: string;
  channel: Channel;
  externalId: string;
  status: ConversationStatus;
  failedLookups: number;
};

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProductRecord = {
  sku: string;
  name: string;
  origin: string;
  roast: string;
  process: string;
  tastingNotes: string;
  weightGrams: number;
  priceIdr: number;
  stock: number;
};

export type PolicyMatch = {
  source: string;
  heading: string;
  content: string;
  similarity: number;
};

export type TicketCategory = "order" | "shipping" | "product" | "payment" | "handoff" | "other";

export type NewTicket = {
  conversationId: string | null;
  category: TicketCategory;
  priority: "normal" | "high";
  subject: string;
  details: string;
  contact?: string;
  orderNumber?: string;
};

/**
 * Everything the bot reads or writes goes through this, so the chat flow can
 * run against an in-memory fake in tests and against Postgres in the app.
 */
export interface SupportStore {
  getOrCreateConversation(channel: Channel, externalId: string): Promise<Conversation>;
  getRecentMessages(conversationId: string, limit: number): Promise<StoredMessage[]>;
  saveMessage(conversationId: string, message: StoredMessage & { toolCalls?: string[] }): Promise<void>;
  markHandoff(conversationId: string): Promise<void>;
  /** Returns the new number of failed lookups for the conversation. */
  recordFailedLookup(conversationId: string): Promise<number>;
  findOrder(orderNumber: string): Promise<OrderRecord | null>;
  searchProducts(query: string | undefined, limit: number): Promise<ProductRecord[]>;
  searchPolicies(embedding: number[], limit: number): Promise<PolicyMatch[]>;
  createTicket(ticket: NewTicket): Promise<{ id: number; code: string }>;
}

export function ticketCode(id: number): string {
  return `TK-${String(id).padStart(4, "0")}`;
}
