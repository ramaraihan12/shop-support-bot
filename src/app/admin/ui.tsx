import type { ReactNode } from "react";
import { ticketCode } from "@/lib/store/types";
import type { TicketRow } from "@/lib/admin/queries";
import { updateTicketStatus } from "./actions";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(date: Date) {
  return dateFormat.format(date);
}

const TONES = {
  neutral: "border-husk bg-paper text-muted",
  green: "border-bean/30 bg-bean/10 text-bean-deep",
  red: "border-cherry/30 bg-cherry/10 text-cherry",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Section({ title, count, children }: { title: string; count: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-bold">
        {title} <span className="text-base font-medium text-muted">{count}</span>
      </h2>
      <div className="overflow-x-auto rounded-xl border border-husk bg-panel">{children}</div>
    </section>
  );
}

export function TicketTable({ tickets, showConversation = true }: { tickets: TicketRow[]; showConversation?: boolean }) {
  if (tickets.length === 0) return <p className="px-4 py-6 text-sm text-muted">Belum ada tiket.</p>;

  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-husk text-xs uppercase tracking-wide text-muted">
        <tr>
          <th className="px-4 py-2.5 font-medium">Tiket</th>
          <th className="px-4 py-2.5 font-medium">Masalah</th>
          <th className="px-4 py-2.5 font-medium">Kontak</th>
          <th className="px-4 py-2.5 font-medium">Dibuat</th>
          <th className="px-4 py-2.5 font-medium">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-husk">
        {tickets.map((ticket) => (
          <tr key={ticket.id} className={ticket.status === "closed" ? "opacity-55" : undefined}>
            <td className="px-4 py-3 align-top">
              <div className="font-mono text-xs">{ticketCode(ticket.id)}</div>
              <div className="mt-1 flex gap-1">
                <Badge>{ticket.category}</Badge>
                {ticket.priority === "high" && <Badge tone="red">high</Badge>}
              </div>
            </td>
            <td className="max-w-md px-4 py-3 align-top">
              <div className="font-medium">{ticket.subject}</div>
              <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-muted">{ticket.details}</p>
              {showConversation && ticket.conversationId && (
                <a href={`/admin/conversations/${ticket.conversationId}`} className="mt-1 inline-block text-xs text-bean underline">
                  Lihat percakapan
                </a>
              )}
            </td>
            <td className="px-4 py-3 align-top">
              <div>{ticket.contact ?? <span className="text-muted">-</span>}</div>
              {ticket.orderNumber && <div className="font-mono text-xs text-muted">{ticket.orderNumber}</div>}
            </td>
            <td className="whitespace-nowrap px-4 py-3 align-top text-muted">{formatTime(ticket.createdAt)}</td>
            <td className="px-4 py-3 align-top">
              <form action={updateTicketStatus}>
                <input type="hidden" name="id" value={ticket.id} />
                <input type="hidden" name="status" value={ticket.status === "open" ? "closed" : "open"} />
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-lg border border-husk px-2.5 py-1 text-xs hover:border-bean hover:text-bean-deep"
                >
                  {ticket.status === "open" ? "Tutup" : "Buka lagi"}
                </button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
