"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

const SUGGESTIONS = [
  "Pesanan saya sudah sampai mana?",
  "Stok Gayo Wine masih ada?",
  "Do you ship to Bali? How long does it take?",
  "Kalau kopinya rusak, bisa retur?",
];

const TOOL_LABELS: Record<string, { running: string; done: string }> = {
  searchPolicies: { running: "Membaca kebijakan toko", done: "Kebijakan toko" },
  checkStock: { running: "Cek stok", done: "Stok dicek" },
  lookupOrder: { running: "Cek pesanan", done: "Pesanan dicek" },
  createTicket: { running: "Membuat tiket", done: "Tiket dibuat" },
  handoffToHuman: { running: "Meneruskan ke tim CS", done: "Diteruskan ke tim CS" },
};

const MAX_LENGTH = 1000;

// The server keeps the history, so only the newest message is sent.
const transport = new DefaultChatTransport({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages }) => ({
    body: { id, message: messages.at(-1) },
  }),
});

export function Chat() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, clearError } = useChat({ transport });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (error) clearError();
    void sendMessage({ text: trimmed });
    setInput("");
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-husk bg-panel">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <BeanMark />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold leading-tight">Kopi Nusantara</h1>
            <p className="text-sm text-muted">Bantuan pelanggan · customer support</p>
          </div>
          <p className="hidden text-right text-xs text-muted sm:block">
            Bot 24 jam
            <br />
            Tim CS Sen-Sab 09.00-17.00 WIB
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
          {messages.length === 0 ? (
            <Welcome onPick={send} />
          ) : (
            messages.map((message) => <MessageRow key={message.id} message={message} />)
          )}
          {status === "submitted" && <Typing />}
          {error && (
            <p role="alert" className="rounded-lg border border-cherry/30 bg-cherry/5 px-3 py-2 text-sm text-cherry">
              Pesan tidak terkirim. Coba lagi sebentar lagi.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t border-husk bg-panel">
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 py-3">
          <label htmlFor="message" className="sr-only">
            Tulis pesan
          </label>
          <textarea
            id="message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder="Tulis pesan... / Type a message..."
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-husk bg-paper px-3 py-2.5 text-[15px] leading-snug placeholder:text-muted/70"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-11 rounded-xl bg-bean px-4 text-sm font-semibold text-white transition-colors hover:bg-bean-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kirim
          </button>
        </div>
        <p className="mx-auto max-w-2xl px-4 pb-3 text-xs text-muted">
          Cek pesanan butuh nomor pesanan (KN-12345) dan email atau nomor HP yang dipakai saat checkout.
        </p>
      </form>
    </div>
  );
}

function MessageRow({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("")
    .trim();
  const tools = message.parts.filter(isToolUIPart);

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
      {tools.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Langkah bot">
          {tools.map((part) => {
            const label = TOOL_LABELS[getToolName(part)];
            const done = part.state === "output-available" || part.state === "output-error";
            return (
              <li
                key={part.toolCallId}
                className="flex items-center gap-1.5 rounded-full border border-husk bg-panel px-2.5 py-0.5 font-mono text-[11px] text-muted"
              >
                <span
                  className={`size-1.5 rounded-full ${done ? "bg-bean" : "animate-pulse bg-muted"}`}
                  aria-hidden
                />
                {done ? label?.done : label?.running}
              </li>
            );
          })}
        </ul>
      )}
      {text && (
        <p
          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
            isUser ? "rounded-br-sm bg-bean text-white" : "rounded-bl-sm border border-husk bg-panel"
          }`}
        >
          {text}
        </p>
      )}
    </div>
  );
}

function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="rounded-2xl rounded-bl-sm border border-husk bg-panel px-4 py-3 text-[15px] leading-relaxed">
        Halo! Saya asisten Kopi Nusantara. Tanya soal pesanan, stok, pengiriman, atau retur. You can write in
        English too.
      </div>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="rounded-full border border-bean/40 px-3 py-1.5 text-sm text-bean-deep transition-colors hover:bg-bean hover:text-white"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-sm border border-husk bg-panel px-4 py-3.5" aria-label="Bot sedang mengetik">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-muted"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function BeanMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-bean" />
      <ellipse cx="16" cy="16" rx="7.5" ry="10" transform="rotate(30 16 16)" className="fill-paper" />
      <path
        d="M11.8 23.5c3.2-2.4 1.6-5.2 3.4-7.6s4.8-2.6 5.2-7"
        className="fill-none stroke-bean"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
