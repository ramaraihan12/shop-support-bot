import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RespondDeps } from "@/lib/chat/respond";
import { createRateLimiter } from "@/lib/rate-limit";
import { createTelegramApi, handleTelegramUpdate, telegramUpdateSchema, type TelegramApi } from "@/lib/telegram";
import { MemoryStore } from "./helpers/memory-store";
import { scriptedModel } from "./helpers/mock-model";

function fakeApi() {
  const sent: { chatId: number; text: string }[] = [];
  const api: TelegramApi = {
    sendMessage: async (chatId, text) => {
      sent.push({ chatId, text });
    },
    sendTyping: async () => {},
  };
  return { api, sent };
}

function update(text: string, chat: { id: number; type: string } = { id: 4242, type: "private" }) {
  return telegramUpdateSchema.parse({ update_id: 1, message: { message_id: 7, chat, text } });
}

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

describe("handleTelegramUpdate", () => {
  it("sends the model's full answer back to the same chat", async () => {
    const { api, sent } = fakeApi();
    const model = scriptedModel([
      { toolCall: { name: "checkStock", input: { query: "gayo" } } },
      { text: "Gayo Wine masih ada, Rp135.000." },
    ]);

    await handleTelegramUpdate(deps(model), api, update("stok gayo ada?"));

    expect(sent).toEqual([{ chatId: 4242, text: "Gayo Wine masih ada, Rp135.000." }]);
    expect(store.conversations[0]).toMatchObject({ channel: "telegram", externalId: "4242" });
  });

  it("answers /start without calling the model", async () => {
    const { api, sent } = fakeApi();
    const model = scriptedModel([]);

    await handleTelegramUpdate(deps(model), api, update("/start"));

    expect(sent[0]?.text).toContain("Kopi Nusantara");
    expect(model.doStreamCalls).toHaveLength(0);
    expect(store.conversations).toHaveLength(0);
  });

  it("uses the same handoff guardrail as the web chat", async () => {
    const { api, sent } = fakeApi();

    await handleTelegramUpdate(deps(scriptedModel([])), api, update("tolong sambungkan ke CS"));

    expect(sent[0]?.text).toContain("TK-0001");
    expect(store.tickets[0]).toMatchObject({ category: "handoff", priority: "high" });
  });

  it("ignores group chats and updates without text", async () => {
    const { api, sent } = fakeApi();
    const model = scriptedModel([]);

    await handleTelegramUpdate(deps(model), api, update("KN-10234 status?", { id: -100, type: "group" }));
    await handleTelegramUpdate(deps(model), api, telegramUpdateSchema.parse({ update_id: 2 }));

    expect(sent).toEqual([]);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("falls back to an apology when the model call fails", async () => {
    const { api, sent } = fakeApi();
    const model = scriptedModel([]);
    model.doStream = async () => {
      throw new Error("connection refused");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    await handleTelegramUpdate(deps(model), api, update("Halo kak, kirim ke Medan berapa lama?"));

    expect(sent[0]?.text).toContain("sistem kami sedang bermasalah");
  });
});

describe("createTelegramApi", () => {
  it("posts to the Bot API and caps the message length", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    const api = createTelegramApi("123:abc", fetchFn);

    await api.sendMessage(4242, "x".repeat(5000));

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bot123:abc/sendMessage");
    const body = JSON.parse(String(init?.body)) as { chat_id: number; text: string };
    expect(body.chat_id).toBe(4242);
    expect(body.text).toHaveLength(4096);
  });

  it("throws with Telegram's error so the route can log it", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response("chat not found", { status: 400 }));

    await expect(createTelegramApi("t", fetchFn).sendMessage(1, "hi")).rejects.toThrow(/400: chat not found/);
  });
});
