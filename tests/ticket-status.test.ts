import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { detectHandoff } from "@/lib/chat/handoff";
import { replies } from "@/lib/chat/replies";
import { MAX_STEPS, respond, type RespondDeps } from "@/lib/chat/respond";
import { mentionsTicket, ticketStatusLine } from "@/lib/chat/ticket-status";
import { createRateLimiter } from "@/lib/rate-limit";
import { MemoryStore } from "./helpers/memory-store";
import { scriptedModel } from "./helpers/mock-model";

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

function deps(model: RespondDeps["model"]): RespondDeps {
  return {
    store,
    model,
    embed: async () => [0.1],
    limiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
  };
}

async function send(model: RespondDeps["model"], text: string, externalId = "session-1") {
  const reply = await respond(deps(model), { channel: "web", externalId, text });
  if (reply.kind !== "model") throw new Error("expected a model reply");
  return { result: reply.result, text: await reply.result.text };
}

const validTicket = {
  category: "order",
  subject: "Kemasan sobek",
  details: "Paket KN-10234 datang dengan kemasan sobek.",
  contact: "bagus.pratama@example.com",
};
const none = replies.ticketStatus.none("id");
const withLine = (text: string, line: string) => `${text}\n\n${line}`;

async function openTicketBefore(externalId = "session-1") {
  const conversation = await store.getOrCreateConversation("web", externalId);
  return store.createTicket({
    conversationId: conversation.id,
    category: "other",
    priority: "normal",
    subject: "Pertanyaan lain",
    details: "Detail pertanyaan.",
  });
}

describe("mentionsTicket", () => {
  it.each(["Tiket Anda sudah dibuat", "your ticket", "Tickets are answered", "TIKETNYA", "kode TK-0001", "ref TKT-20261121-001", "tk0042"])(
    "sees a ticket in: %s",
    (text) => expect(mentionsTicket(text)).toBe(true),
  );

  it.each(["Pesanan KN-10234 sudah dikirim", "Gayo masih ada", "multiticket", "stiker lucu"])("leaves alone: %s", (text) =>
    expect(mentionsTicket(text)).toBe(false),
  );

  it("stays fast on long runs of whitespace and dashes", () => {
    const start = Date.now();
    mentionsTicket(`${" ".repeat(200_000)}tk${"-".repeat(200_000)}`);
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe("ticketStatusLine", () => {
  it("does not add its own line twice", async () => {
    const reply = withLine("Tiket sudah dibuat.", none);
    expect(await ticketStatusLine({ reply, language: "id", listTicketCodes: async () => [] })).toBeNull();
  });

  it("treats TK0001 and tk-0001 as the real TK-0001", async () => {
    const line = await ticketStatusLine({ reply: "Tiket tk0001 dibuat.", language: "id", listTicketCodes: async () => ["TK-0001"] });
    expect(line).toBeNull();
  });
});

describe("the status line and the handoff detector", () => {
  it.each(["id", "en"] as const)("every phrase quoted in the %s line really starts a handoff", (language) => {
    const phrases = [...replies.ticketStatus.none(language).matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(phrases.length).toBeGreaterThan(0);
    for (const phrase of phrases) expect(detectHandoff(phrase)).toBe("asked_for_human");
  });
});

describe("a reply that talks about a ticket nobody opened", () => {
  it.each([
    "Saya sudah membuka tiket untuk laporan kemasan sobek. Tim kami akan menghubungi kamu.",
    "Saya akan segera membuatkan tiket dukungan untuk kasus ini. Karena Anda telah memberikan email dan nomor pesanan, saya akan langsung membuka tiket untuk tim kami. Silakan tunggu email konfirmasi dengan kode tiketnya.",
    "Tiket Anda telah dibuat dengan kode **TKT-20261121-001**.",
  ])("gets the none line: %s", async (reply) => {
    const { text } = await send(scriptedModel([{ text: reply }]), "tolong buatkan tiket, email saya andi@example.com");

    expect(text).toBe(withLine(reply, none));
    expect(store.tickets).toHaveLength(0);
  });

  it("gets the line for an offer or a policy mention too, since it is true there as well", async () => {
    const reply = "Mau saya buatkan tiket? Tiket dibalas dalam 1x24 jam kerja.";
    const { text } = await send(scriptedModel([{ text: reply }]), "kemasannya sobek");
    expect(text).toBe(withLine(reply, none));
  });

  it("writes the line in English for an English customer", async () => {
    const reply = "I've opened a ticket for the torn packaging.";
    const { text } = await send(scriptedModel([{ text: reply }]), "The package arrived torn, please open a ticket");
    expect(text).toBe(withLine(reply, replies.ticketStatus.none("en")));
  });

  it("saves the line with the assistant message", async () => {
    await send(scriptedModel([{ text: "Saya sudah membuka tiket." }]), "buatkan tiket");
    expect(store.messages.at(-1)?.content).toBe(withLine("Saya sudah membuka tiket.", none));
  });

  it("still gets the none line when createTicket was rejected by validation", async () => {
    const model = scriptedModel([
      { toolCall: { name: "createTicket", input: { ...validTicket, subject: "x" } } },
      { text: "Tiket Anda sudah dibuat." },
    ]);

    const { text } = await send(model, "paket saya sobek");

    expect(store.tickets).toHaveLength(0);
    expect(text).toBe(withLine("Tiket Anda sudah dibuat.", none));
  });

  it("gets the none line again when an invented code is repeated on a later turn", async () => {
    const invented = "Tiket Anda telah dibuat dengan kode TKT-20261121-001.";
    await send(scriptedModel([{ text: invented }]), "buatkan tiket");
    const { text } = await send(scriptedModel([{ text: invented }]), "mana kode tiketnya?");
    expect(text).toBe(withLine(invented, none));
  });

  it("gets the none line when the model echoes a code the customer typed", async () => {
    const { text } = await send(scriptedModel([{ text: "Tiket TK-0042 sedang diproses." }]), "status tiket TK-0042 dong");
    expect(text).toBe(withLine("Tiket TK-0042 sedang diproses.", none));
  });
});

describe("a reply when tickets exist", () => {
  it("adds nothing when createTicket succeeded and the reply quotes only that code", async () => {
    const model = scriptedModel([
      { toolCall: { name: "createTicket", input: validTicket } },
      { text: "Tiket TK-0001 sudah dibuat." },
    ]);

    const { text } = await send(model, "paket saya sobek");

    expect(text).toBe("Tiket TK-0001 sudah dibuat.");
  });

  it("lists the real tickets when an earlier turn opened one and the reply claims a new one without a code", async () => {
    await openTicketBefore();
    const { text } = await send(scriptedModel([{ text: "Saya sudah membuka tiket baru untuk kamu." }]), "ada masalah lagi");
    expect(text).toBe(withLine("Saya sudah membuka tiket baru untuk kamu.", replies.ticketStatus.open("id", ["TK-0001"])));
  });

  it("lists the real tickets when an invented code appears next to a real one", async () => {
    const model = scriptedModel([
      { toolCall: { name: "createTicket", input: validTicket } },
      { text: "Tiket TK-0001 dan tiket TKT-20261121-001 sudah dibuat." },
    ]);

    const { text } = await send(model, "paket saya sobek");

    expect(text).toBe(withLine("Tiket TK-0001 dan tiket TKT-20261121-001 sudah dibuat.", replies.ticketStatus.open("id", ["TK-0001"])));
  });

  it("lists the ticket when the insert worked but the handoff failed afterwards", async () => {
    vi.spyOn(store, "markHandoff").mockRejectedValue(new Error("connection lost"));
    const model = scriptedModel([
      { toolCall: { name: "handoffToHuman", input: { reason: "Customer is frustrated about delays" } } },
      { text: "Tiket sudah dibuat untuk tim kami." },
    ]);

    const { text } = await send(model, "ini sudah ketiga kalinya telat, saya capek nanya terus");

    expect(store.tickets).toHaveLength(1);
    expect(text).toBe(withLine("Tiket sudah dibuat untuk tim kami.", replies.ticketStatus.open("id", ["TK-0001"])));
  });
});

describe("a reply that doesn't mention tickets", () => {
  it("is left alone and the database is not asked", async () => {
    const lookup = vi.spyOn(store, "listTicketCodes");
    const { text } = await send(scriptedModel([{ text: "Gayo Wine masih ada, Rp135.000." }]), "stok gayo?");

    expect(text).toBe("Gayo Wine masih ada, Rp135.000.");
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("when the lookup fails", () => {
  it("leaves the reply as the model wrote it and logs the error", async () => {
    vi.spyOn(store, "listTicketCodes").mockRejectedValue(new Error("db down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { text } = await send(scriptedModel([{ text: "Saya sudah membuka tiket." }]), "buatkan tiket");

    expect(text).toBe("Saya sudah membuka tiket.");
    expect(logged).toHaveBeenCalledWith("ticket lookup failed", expect.any(Error));
    logged.mockRestore();
  });
});

describe("which step gets the line", () => {
  const stock = { name: "checkStock", input: { query: "gayo" } };

  it("counts text from a step before the last one", async () => {
    const model = scriptedModel([
      { text: "Saya sudah membuka tiket untuk kamu.", toolCall: stock },
      { text: "Gayo Wine masih ada." },
    ]);

    const { text } = await send(model, "stok gayo ada?");

    expect(text).toBe(withLine("Gayo Wine masih ada.", none));
  });

  it("does not add the line early to a step that reports 'stop' but called a tool", async () => {
    const model = scriptedModel([
      { text: "Saya sudah membuka tiket.", toolCall: stock, finishReason: "stop" },
      { text: "Gayo Wine masih ada." },
    ]);

    const { result, text } = await send(model, "stok gayo ada?");
    const steps = await result.steps;

    expect(steps[0]?.text).toBe("Saya sudah membuka tiket.");
    expect(text).toBe(withLine("Gayo Wine masih ada.", none));
  });

  it("adds the line when the step limit ends the loop on a tool call", async () => {
    const steps = Array.from({ length: MAX_STEPS }, (_, i) => ({
      toolCall: stock,
      ...(i === MAX_STEPS - 1 ? { text: "Tiket sudah dibuat." } : {}),
    }));

    const { text } = await send(scriptedModel(steps), "stok gayo ada?");

    expect(text).toBe(withLine("Tiket sudah dibuat.", none));
  });
});

describe("streaming", () => {
  it("passes the model's text on before the model has finished", async () => {
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    };
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: "text-start", id: "t" });
            controller.enqueue({ type: "text-delta", id: "t", delta: "Saya sudah membuka tiket." });
            await gate;
            controller.enqueue({ type: "text-end", id: "t" });
            controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage });
            controller.close();
          },
        }),
      }),
    });
    const reply = await respond(deps(model), { channel: "web", externalId: "session-1", text: "buatkan tiket" });
    if (reply.kind !== "model") throw new Error("expected a model reply");

    const reader = reply.result.textStream[Symbol.asyncIterator]();
    const first = await Promise.race([reader.next(), new Promise<"stuck">((resolve) => setTimeout(() => resolve("stuck"), 1000))]);
    release();

    expect(first).toEqual({ done: false, value: "Saya sudah membuka tiket." });
    const rest: string[] = [];
    for (let next = await reader.next(); !next.done; next = await reader.next()) rest.push(next.value);
    expect(rest.join("")).toBe(`\n\n${none}`);
  });
});
