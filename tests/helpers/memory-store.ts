import { randomUUID } from "node:crypto";
import type { OrderRecord } from "@/lib/orders";
import {
  ticketCode,
  type Conversation,
  type NewTicket,
  type PolicyMatch,
  type ProductRecord,
  type StoredMessage,
  type SupportStore,
} from "@/lib/store/types";

export const orderFixtures: OrderRecord[] = [
  {
    number: "KN-10234",
    status: "shipped",
    shippingCity: "Surabaya",
    courier: "SiCepat REG",
    trackingNumber: "0044 0234 1187",
    totalIdr: 257_000,
    placedAt: new Date("2026-10-15T03:00:00Z"),
    shippedAt: new Date("2026-10-17T03:00:00Z"),
    deliveredAt: null,
    customer: { name: "Bagus Pratama", email: "bagus.pratama@example.com", phone: "6281300002202" },
    items: [
      { name: "Toraja Sapan", quantity: 1 },
      { name: "Flores Bajawa Honey", quantity: 1 },
    ],
  },
  {
    number: "KN-10235",
    status: "processing",
    shippingCity: "Yogyakarta",
    courier: null,
    trackingNumber: null,
    totalIdr: 300_000,
    placedAt: new Date("2026-10-18T03:00:00Z"),
    shippedAt: null,
    deliveredAt: null,
    customer: { name: "Maya Kusuma", email: "maya.kusuma@example.com", phone: "6285700003303" },
    items: [{ name: "Papua Wamena", quantity: 2 }],
  },
];

export const productFixtures: ProductRecord[] = [
  { sku: "GAYO-WN-200", name: "Gayo Wine Process", origin: "Aceh Tengah", roast: "medium", process: "wine", tastingNotes: "anggur merah", weightGrams: 200, priceIdr: 135_000, stock: 18 },
  { sku: "TORAJA-SP-200", name: "Toraja Sapan", origin: "Toraja", roast: "medium-dark", process: "full wash", tastingNotes: "gula aren", weightGrams: 200, priceIdr: 120_000, stock: 3 },
  { sku: "KINTAMANI-NT-200", name: "Kintamani Natural", origin: "Bangli, Bali", roast: "light", process: "natural", tastingNotes: "jeruk", weightGrams: 200, priceIdr: 125_000, stock: 0 },
];

type SavedMessage = StoredMessage & { conversationId: string; toolCalls?: string[] };

export class MemoryStore implements SupportStore {
  conversations: Conversation[] = [];
  messages: SavedMessage[] = [];
  tickets: (NewTicket & { id: number })[] = [];
  orderLookups: string[] = [];
  policyMatches: PolicyMatch[] = [];

  async getOrCreateConversation(channel: Conversation["channel"], externalId: string) {
    let conversation = this.conversations.find(
      (c) => c.channel === channel && c.externalId === externalId,
    );
    if (!conversation) {
      conversation = { id: randomUUID(), channel, externalId, status: "bot", failedLookups: 0 };
      this.conversations.push(conversation);
    }
    // Hand out a copy, like a database row would be.
    return { ...conversation };
  }

  async getRecentMessages(conversationId: string, limit: number) {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .slice(-limit)
      .map(({ role, content }) => ({ role, content }));
  }

  async saveMessage(conversationId: string, message: StoredMessage & { toolCalls?: string[] }) {
    this.messages.push({ conversationId, ...message });
  }

  async markHandoff(conversationId: string) {
    this.conversation(conversationId).status = "handoff";
  }

  async recordFailedLookup(conversationId: string) {
    return ++this.conversation(conversationId).failedLookups;
  }

  async findOrder(orderNumber: string) {
    this.orderLookups.push(orderNumber);
    return orderFixtures.find((o) => o.number === orderNumber) ?? null;
  }

  async searchProducts(query: string | undefined, limit: number) {
    const q = query?.toLowerCase();
    return productFixtures
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.origin.toLowerCase().includes(q))
      .slice(0, limit);
  }

  async searchPolicies(_embedding: number[], limit: number) {
    return this.policyMatches.slice(0, limit);
  }

  async createTicket(ticket: NewTicket) {
    const id = this.tickets.length + 1;
    this.tickets.push({ ...ticket, id });
    return { id, code: ticketCode(id) };
  }

  private conversation(id: string): Conversation {
    const conversation = this.conversations.find((c) => c.id === id);
    if (!conversation) throw new Error(`No conversation ${id}`);
    return conversation;
  }
}
