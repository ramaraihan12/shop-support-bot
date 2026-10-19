import { asc, count, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { conversations, messages, tickets } from "@/lib/db/schema";

const ticketColumns = {
  id: tickets.id,
  conversationId: tickets.conversationId,
  category: tickets.category,
  priority: tickets.priority,
  status: tickets.status,
  subject: tickets.subject,
  details: tickets.details,
  contact: tickets.contact,
  orderNumber: tickets.orderNumber,
  createdAt: tickets.createdAt,
};

export type TicketRow = Awaited<ReturnType<typeof listTickets>>[number];

export function listTickets(db: Database, limit = 50) {
  return db
    .select(ticketColumns)
    .from(tickets)
    // Open tickets first, high priority on top, newest first within that.
    .orderBy(asc(tickets.status), desc(tickets.priority), desc(tickets.createdAt))
    .limit(limit);
}

export async function listConversations(db: Database, limit = 50) {
  const stats = db
    .select({ conversationId: messages.conversationId, messageCount: count().as("message_count") })
    .from(messages)
    .groupBy(messages.conversationId)
    .as("stats");

  const lastMessage = db
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId,
      content: messages.content,
    })
    .from(messages)
    .orderBy(messages.conversationId, desc(messages.createdAt), desc(messages.id))
    .as("last_message");

  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      status: conversations.status,
      updatedAt: conversations.updatedAt,
      messageCount: stats.messageCount,
      lastMessage: lastMessage.content,
    })
    .from(conversations)
    .leftJoin(stats, eq(stats.conversationId, conversations.id))
    .leftJoin(lastMessage, eq(lastMessage.conversationId, conversations.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, messageCount: row.messageCount ?? 0 }));
}

export async function getConversation(db: Database, id: string) {
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  if (!conversation) return null;

  const [transcript, related] = await Promise.all([
    db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        toolCalls: messages.toolCalls,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt), asc(messages.id)),
    db.select(ticketColumns).from(tickets).where(eq(tickets.conversationId, id)).orderBy(desc(tickets.createdAt)),
  ]);

  return { conversation, messages: transcript, tickets: related };
}

export async function setTicketStatus(db: Database, id: number, status: "open" | "closed") {
  await db.update(tickets).set({ status }).where(eq(tickets.id, id));
}

/** Gives the conversation back to the bot once the team is done with it. */
export async function returnToBot(db: Database, id: string) {
  await db
    .update(conversations)
    .set({ status: "bot", failedLookups: 0, updatedAt: sql`now()` })
    .where(eq(conversations.id, id));
}
