import { beforeEach, describe, expect, it } from "vitest";
import { respond, type RespondDeps } from "@/lib/chat/respond";
import { MAX_FAILED_LOOKUPS } from "@/lib/chat/tools";
import { createRateLimiter } from "@/lib/rate-limit";
import { MemoryStore } from "./helpers/memory-store";
import { promptText, scriptedModel } from "./helpers/mock-model";

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

function deps(model: RespondDeps["model"], overrides: Partial<RespondDeps> = {}): RespondDeps {
  return {
    store,
    model,
    embed: async () => [0.1, 0.2, 0.3],
    limiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    ...overrides,
  };
}

async function send(d: RespondDeps, text: string, externalId = "session-1") {
  const reply = await respond(d, { channel: "web", externalId, text });
  if (reply.kind === "model") {
    return { reply, text: await reply.result.text };
  }
  return { reply, text: reply.text };
}

describe("order lookup", () => {
  it("returns the order when number and email match", async () => {
    const model = scriptedModel([
      { toolCall: { name: "lookupOrder", input: { orderNumber: "KN-10234", email: "bagus.pratama@example.com" } } },
      { text: "Pesanan KN-10234 sudah dikirim lewat SiCepat." },
    ]);

    const { text } = await send(deps(model), "Pesanan KN-10234 sampai mana? email bagus.pratama@example.com");

    expect(text).toBe("Pesanan KN-10234 sudah dikirim lewat SiCepat.");
    const toolResult = promptText(model, 1);
    expect(toolResult).toContain('"status":"found"');
    expect(toolResult).toContain("0044 0234 1187");
  });

  it("does not leak an order to someone with another customer's email", async () => {
    const model = scriptedModel([
      { toolCall: { name: "lookupOrder", input: { orderNumber: "KN-10234", email: "maya.kusuma@example.com" } } },
      { text: "Datanya tidak cocok." },
    ]);

    await send(deps(model), "cek KN-10234, email maya.kusuma@example.com");

    const toolResult = promptText(model, 1);
    expect(toolResult).toContain('"status":"not_found"');
    expect(toolResult).not.toContain("SiCepat");
    expect(toolResult).not.toContain("Surabaya");
    expect(store.conversations[0]?.failedLookups).toBe(1);
  });

  it("answers a missing order the same way as a wrong email", async () => {
    const model = scriptedModel([
      { toolCall: { name: "lookupOrder", input: { orderNumber: "KN-99999", email: "bagus.pratama@example.com" } } },
      { text: "Tidak ketemu." },
    ]);

    await send(deps(model), "cek KN-99999");

    expect(promptText(model, 1)).toContain("No order matches that number together with that email or phone.");
  });

  it("rejects a lookup without email or phone before touching the store", async () => {
    const model = scriptedModel([
      { toolCall: { name: "lookupOrder", input: { orderNumber: "KN-10234" } } },
      { text: "Boleh minta email atau nomor HP yang dipakai saat checkout?" },
    ]);

    await send(deps(model), "status KN-10234?");

    expect(store.orderLookups).toEqual([]);
    expect(promptText(model, 1)).toContain("Ask the customer for the email or phone number used at checkout");
  });

  it("rejects a malformed order number", async () => {
    const model = scriptedModel([
      { toolCall: { name: "lookupOrder", input: { orderNumber: "' OR 1=1 --", email: "a@example.com" } } },
      { text: "Nomor pesanannya formatnya KN-12345 ya." },
    ]);

    await send(deps(model), "cek pesanan semua orang");

    expect(store.orderLookups).toEqual([]);
  });

  it("locks lookups after too many failures in one chat", async () => {
    const failing = { name: "lookupOrder", input: { orderNumber: "KN-10234", email: "guess@example.com" } };
    for (let i = 0; i < MAX_FAILED_LOOKUPS; i++) {
      await send(deps(scriptedModel([{ toolCall: failing }, { text: "Tidak cocok." }])), "cek pesanan");
    }

    const correct = { name: "lookupOrder", input: { orderNumber: "KN-10234", email: "bagus.pratama@example.com" } };
    const model = scriptedModel([{ toolCall: correct }, { text: "Coba hubungi tim kami." }]);
    await send(deps(model), "cek lagi");

    expect(promptText(model, 1)).toContain('"status":"locked"');
    expect(promptText(model, 1)).not.toContain("SiCepat");
    expect(store.orderLookups).toHaveLength(MAX_FAILED_LOOKUPS);
  });
});

describe("other tools", () => {
  it("reports stock without exact counts unless it is running low", async () => {
    const model = scriptedModel([
      { toolCall: { name: "checkStock", input: { query: "toraja" } } },
      { text: "Toraja tinggal 3." },
    ]);

    await send(deps(model), "stok toraja ada?");

    const result = promptText(model, 1);
    expect(result).toContain('"availability":"low_stock"');
    expect(result).toContain('"unitsLeft":3');
  });

  it("only passes policy chunks that are similar enough", async () => {
    store.policyMatches = [
      { source: "pengiriman.md", heading: "Pengiriman > Kurir", content: "JNE ke Bali 3-5 hari.", similarity: 0.71 },
      { source: "pembayaran.md", heading: "Pembayaran > Metode", content: "QRIS diterima.", similarity: 0.12 },
    ];
    const model = scriptedModel([
      { toolCall: { name: "searchPolicies", input: { query: "shipping to Bali" } } },
      { text: "Yes, 3-5 days with JNE." },
    ]);

    await send(deps(model), "Do you ship to Bali?");

    const result = promptText(model, 1);
    expect(result).toContain("JNE ke Bali 3-5 hari.");
    expect(result).not.toContain("QRIS diterima.");
  });

  it("opens a ticket linked to the conversation", async () => {
    const model = scriptedModel([
      {
        toolCall: {
          name: "createTicket",
          input: {
            category: "order",
            subject: "Kemasan sobek",
            details: "Paket KN-10234 datang dengan kemasan sobek.",
            contact: "bagus.pratama@example.com",
            orderNumber: "kn-10234",
          },
        },
      },
      { text: "Tiket TK-0001 sudah dibuat." },
    ]);

    await send(deps(model), "paket saya sobek");

    expect(store.tickets).toHaveLength(1);
    expect(store.tickets[0]).toMatchObject({
      conversationId: store.conversations[0]?.id,
      priority: "normal",
      orderNumber: "KN-10234",
    });
    expect(promptText(model, 1)).toContain("TK-0001");
  });

  it("lets the model hand off when it notices frustration the keywords missed", async () => {
    const model = scriptedModel([
      { toolCall: { name: "handoffToHuman", input: { reason: "Customer is frustrated about repeated delays" } } },
      { text: "Saya teruskan ke tim kami." },
    ]);

    await send(deps(model), "ini sudah ketiga kalinya telat, saya capek nanya terus");

    expect(store.conversations[0]?.status).toBe("handoff");
    expect(store.tickets[0]).toMatchObject({ category: "handoff", priority: "high" });
  });
});

describe("conversation flow", () => {
  it("saves both sides and records which tools ran", async () => {
    const model = scriptedModel([
      { toolCall: { name: "checkStock", input: { query: "gayo" } } },
      { text: "Gayo ready, Rp135.000." },
    ]);

    await send(deps(model), "gayo ready?");

    expect(store.messages.map((m) => [m.role, m.content, m.toolCalls])).toEqual([
      ["user", "gayo ready?", undefined],
      ["assistant", "Gayo ready, Rp135.000.", ["checkStock"]],
    ]);
  });

  it("sends earlier messages as history and keeps instructions out of the messages", async () => {
    await send(deps(scriptedModel([{ text: "Halo! Ada yang bisa dibantu?" }])), "halo");
    const model = scriptedModel([{ text: "Bisa, kak." }]);

    await send(deps(model), "bisa kirim ke Medan?");

    const prompt = model.doStreamCalls[0]?.prompt ?? [];
    expect(prompt.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
  });

  it("forces a text answer on the last step", async () => {
    const loop = { toolCall: { name: "checkStock", input: {} } };
    const model = scriptedModel([loop, loop, loop, loop, loop, { text: "Ini katalog kami." }]);

    const { text } = await send(deps(model), "ada apa aja?");

    expect(text).toBe("Ini katalog kami.");
    expect(model.doStreamCalls.at(-1)?.toolChoice).toEqual({ type: "none" });
  });
});

describe("guardrails before the model", () => {
  it("hands off on an explicit request without calling the model", async () => {
    const model = scriptedModel([]);

    const { reply, text } = await send(deps(model), "mau bicara sama admin aja");

    expect(reply.kind).toBe("handoff");
    expect(text).toContain("TK-0001");
    expect(model.doStreamCalls).toHaveLength(0);
    expect(store.conversations[0]?.status).toBe("handoff");
    expect(store.tickets[0]).toMatchObject({ category: "handoff", priority: "high" });
  });

  it("keeps the bot quiet after a handoff", async () => {
    await send(deps(scriptedModel([])), "I want to talk to a human");
    const model = scriptedModel([{ text: "should not be used" }]);

    const { text } = await send(deps(model), "my email is bagus.pratama@example.com");

    expect(model.doStreamCalls).toHaveLength(0);
    expect(text).toContain("support team will reply");
    expect(store.tickets).toHaveLength(1);
  });

  it("rate limits per session without touching the store", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    await send(deps(scriptedModel([{ text: "Halo!" }]), { limiter }), "halo");

    const { reply } = await send(deps(scriptedModel([]), { limiter }), "halo lagi");

    expect(reply.kind).toBe("rate_limited");
    expect(store.messages).toHaveLength(2);

    const other = await send(deps(scriptedModel([{ text: "Hai" }]), { limiter }), "halo", "session-2");
    expect(other.reply.kind).toBe("model");
  });
});
