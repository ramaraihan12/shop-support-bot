import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { getConversation } from "@/lib/admin/queries";
import { getDb } from "@/lib/db";
import { handBackToBot } from "../../actions";
import { Badge, formatTime, Section, TicketTable } from "../../ui";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const data = await getConversation(getDb(), id.data);
  if (!data) notFound();
  const { conversation, messages, tickets } = data;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-bean underline">
            Kembali
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold">Percakapan {conversation.channel}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-mono text-xs">{conversation.externalId}</span>
            {conversation.status === "handoff" ? <Badge tone="red">dipegang tim CS</Badge> : <Badge tone="green">bot</Badge>}
            {conversation.failedLookups > 0 && <Badge>{conversation.failedLookups}x cek pesanan gagal</Badge>}
          </p>
        </div>
        {conversation.status === "handoff" && (
          <form action={handBackToBot}>
            <input type="hidden" name="id" value={conversation.id} />
            <button type="submit" className="rounded-lg bg-bean px-3 py-2 text-sm font-semibold text-white hover:bg-bean-deep">
              Kembalikan ke bot
            </button>
          </form>
        )}
      </div>

      <section className="flex max-w-3xl flex-col gap-3">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                m.role === "user" ? "rounded-br-sm bg-bean text-white" : "rounded-bl-sm border border-husk bg-panel"
              }`}
            >
              {m.content}
            </p>
            <span className="font-mono text-[11px] text-muted">
              {formatTime(m.createdAt)}
              {m.toolCalls?.length ? ` · ${m.toolCalls.join(", ")}` : ""}
            </span>
          </div>
        ))}
      </section>

      <Section title="Tiket" count={tickets.length}>
        <TicketTable tickets={tickets} showConversation={false} />
      </Section>
    </>
  );
}
