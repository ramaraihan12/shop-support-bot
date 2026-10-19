import Link from "next/link";
import { connection } from "next/server";
import { listConversations, listTickets } from "@/lib/admin/queries";
import { getDb } from "@/lib/db";
import { Badge, formatTime, Section, TicketTable } from "./ui";

export default async function AdminPage() {
  await connection();
  const db = getDb();
  const [tickets, conversations] = await Promise.all([listTickets(db), listConversations(db)]);
  const openTickets = tickets.filter((t) => t.status === "open").length;

  return (
    <>
      <Section title="Tiket" count={`${openTickets} terbuka`}>
        <TicketTable tickets={tickets} />
      </Section>

      <Section title="Percakapan" count={conversations.length}>
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Belum ada percakapan.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-husk text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Kanal</th>
                <th className="px-4 py-2.5 font-medium">Pesan terakhir</th>
                <th className="px-4 py-2.5 font-medium">Pesan</th>
                <th className="px-4 py-2.5 font-medium">Terakhir aktif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-husk">
              {conversations.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 align-top">
                    <div className="flex gap-1">
                      <Badge>{c.channel}</Badge>
                      {c.status === "handoff" && <Badge tone="red">ke CS</Badge>}
                    </div>
                  </td>
                  <td className="max-w-lg px-4 py-3 align-top">
                    <Link href={`/admin/conversations/${c.id}`} className="line-clamp-2 hover:text-bean-deep hover:underline">
                      {c.lastMessage ?? "(kosong)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top tabular-nums">{c.messageCount}</td>
                  <td className="whitespace-nowrap px-4 py-3 align-top text-muted">{formatTime(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
