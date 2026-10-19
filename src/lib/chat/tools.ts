import { tool } from "ai";
import { z } from "zod";
import type { EmbedFn } from "@/lib/ai/embeddings";
import { contactMatches, orderNumberSchema, toCustomerView } from "@/lib/orders";
import type { Conversation, ProductRecord, SupportStore } from "@/lib/store/types";
import { startHandoff } from "./handoff";
import { findPolicies } from "./policies";

export const MAX_FAILED_LOOKUPS = 5;
const LOW_STOCK = 5;
const POLICY_RESULTS = 4;

export const lookupOrderInput = z
  .object({
    orderNumber: orderNumberSchema.describe("Order number, format KN-12345"),
    email: z.email().optional().describe("Email used at checkout"),
    phone: z
      .string()
      .regex(/^\+?[\d\s-]{8,18}$/, "Phone numbers contain digits only")
      .optional()
      .describe("Phone number used at checkout"),
  })
  .refine((input) => input.email || input.phone, {
    message: "Ask the customer for the email or phone number used at checkout",
  });

export const createTicketInput = z.object({
  category: z.enum(["order", "shipping", "product", "payment", "other"]),
  subject: z.string().trim().min(5).max(120).describe("One line summary"),
  details: z.string().trim().min(10).max(2000).describe("What happened, in the customer's words"),
  contact: z.string().trim().min(5).max(120).describe("Email or phone number the team can reply to"),
  orderNumber: orderNumberSchema.optional(),
});

type ToolDeps = {
  store: SupportStore;
  conversation: Conversation;
  embed: EmbedFn;
  lastUserMessage: string;
};

export function createSupportTools({ store, conversation, embed, lastUserMessage }: ToolDeps) {
  return {
    searchPolicies: tool({
      description:
        "Search the shop's policy documents: shipping, couriers and delivery times, returns and refunds, payment, cancellations, storage and freshness, wholesale, opening hours and contact.",
      inputSchema: z.object({
        query: z.string().trim().min(3).max(200).describe("The customer's question, rephrased as a search query"),
      }),
      execute: async ({ query }) => ({
        results: await findPolicies(store, embed, query, POLICY_RESULTS),
      }),
    }),

    checkStock: tool({
      description: "Look up coffee products by name, origin or SKU to get price and availability. Leave the query out to list the whole catalog.",
      inputSchema: z.object({
        query: z.string().trim().max(80).optional().describe("Product name or origin, e.g. Gayo or Toraja"),
      }),
      execute: async ({ query }) => {
        const found = await store.searchProducts(query, 10);
        return { products: found.map(toStockView) };
      },
    }),

    lookupOrder: tool({
      description:
        "Get the status of one order. Requires the order number and the email or phone number used at checkout.",
      inputSchema: lookupOrderInput,
      execute: async ({ orderNumber, email, phone }) => {
        if (conversation.failedLookups >= MAX_FAILED_LOOKUPS) {
          return {
            status: "locked" as const,
            message: "Too many failed attempts in this chat. Offer to hand the customer over to the team.",
          };
        }

        const order = await store.findOrder(orderNumber);
        if (!order || !contactMatches(order.customer, { email, phone })) {
          // Same answer for "no such order" and "wrong contact", so the tool
          // can't be used to find out which order numbers exist.
          conversation.failedLookups = await store.recordFailedLookup(conversation.id);
          return {
            status: "not_found" as const,
            message: "No order matches that number together with that email or phone.",
          };
        }

        return { status: "found" as const, order: toCustomerView(order) };
      },
    }),

    createTicket: tool({
      description:
        "Open a support ticket for a problem the team must handle: damaged or wrong items, missing packages, refunds, invoices, wholesale.",
      inputSchema: createTicketInput,
      execute: async (input) => {
        const ticket = await store.createTicket({
          ...input,
          conversationId: conversation.id,
          priority: "normal",
        });
        return { ticketCode: ticket.code };
      },
    }),

    handoffToHuman: tool({
      description:
        "Hand the conversation to a human on the support team. Use when the customer asks for a person or is clearly upset.",
      inputSchema: z.object({
        reason: z.string().trim().min(5).max(300).describe("Short reason for the handoff"),
      }),
      execute: async ({ reason }) => {
        if (conversation.status === "handoff") return { status: "already_handed_off" as const };
        const { ticketCode } = await startHandoff(store, conversation, {
          reason: `Model handoff: ${reason}`,
          lastMessage: lastUserMessage,
        });
        return { status: "handed_off" as const, ticketCode };
      },
    }),
  };
}

export type SupportTools = ReturnType<typeof createSupportTools>;

function toStockView(product: ProductRecord) {
  return {
    name: product.name,
    sku: product.sku,
    origin: product.origin,
    roast: product.roast,
    process: product.process,
    tastingNotes: product.tastingNotes,
    weightGrams: product.weightGrams,
    priceIdr: product.priceIdr,
    availability:
      product.stock === 0 ? "out_of_stock" : product.stock <= LOW_STOCK ? "low_stock" : "in_stock",
    unitsLeft: product.stock > 0 && product.stock <= LOW_STOCK ? product.stock : undefined,
  };
}
