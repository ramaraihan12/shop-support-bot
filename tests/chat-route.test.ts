import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { CHAT_QUOTAS, MAX_BODY_BYTES } from "@/lib/chat/quota";
import { MAX_MESSAGE_CHARS, type RespondDeps } from "@/lib/chat/respond";
import { createRateLimiter } from "@/lib/rate-limit";
import { MemoryStore } from "./helpers/memory-store";
import { scriptedModel } from "./helpers/mock-model";

const mocks = vi.hoisted(() => ({
  deps: undefined as unknown,
  env: { AI_PROVIDER: "google", EMBEDDING_PROVIDER: "google" },
}));

vi.mock("@/lib/chat/deps", () => ({ getRespondDeps: () => mocks.deps }));
vi.mock("@/lib/env", () => ({ getEnv: () => mocks.env }));

const ASK_FOR_HUMAN = "saya mau bicara dengan manusia";

let store: MemoryStore;

function useModel(model: RespondDeps["model"]) {
  mocks.deps = {
    store,
    model,
    embed: async () => [0.1],
    limiter: createRateLimiter({ limit: 1000, windowMs: 60_000 }),
  } satisfies RespondDeps;
}

function post(body: string, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.7", ...headers },
      body,
    }),
  );
}

function chat(text: string, id = "session-1") {
  return post(JSON.stringify({ id, message: { role: "user", parts: [{ type: "text", text }] } }));
}

async function exhaustMinute() {
  for (let i = 0; i < CHAT_QUOTAS.perIpMinute.limit; i++) await chat(ASK_FOR_HUMAN);
}

beforeEach(() => {
  store = new MemoryStore();
  mocks.env = { AI_PROVIDER: "google", EMBEDDING_PROVIDER: "google" };
  useModel(scriptedModel([]));
});

describe("POST /api/chat", () => {
  it("streams the model's answer", async () => {
    useModel(scriptedModel([{ text: "Gayo masih ada." }]));

    const response = await chat("stok gayo ada?");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Gayo masih ada.");
  });

  it("refuses a body over the size cap before doing any work", async () => {
    const response = await post(JSON.stringify({ padding: "x".repeat(MAX_BODY_BYTES) }));

    expect(response.status).toBe(413);
    expect(store.hitCounts.size).toBe(0);
  });

  it("goes by the real size when content-length is wrong", async () => {
    const response = await post(JSON.stringify({ padding: "x".repeat(MAX_BODY_BYTES) }), { "content-length": "10" });

    expect(response.status).toBe(413);
  });

  it("refuses a message over the character cap", async () => {
    const response = await chat("x".repeat(MAX_MESSAGE_CHARS + 1));

    expect(response.status).toBe(413);
    expect(store.hitCounts.size).toBe(0);
    expect(store.conversations).toHaveLength(0);
  });

  it("accepts a message right at the character cap", async () => {
    useModel(scriptedModel([{ text: "Oke." }]));

    expect((await chat("x".repeat(MAX_MESSAGE_CHARS))).status).toBe(200);
  });

  it("doesn't count requests it couldn't parse", async () => {
    expect((await post("not json")).status).toBe(400);
    expect(store.hitCounts.size).toBe(0);
  });

  it("answers from a fixed reply and skips the model once an IP is over its limit", async () => {
    const model = scriptedModel([]);
    useModel(model);
    await exhaustMinute();

    const response = await chat("stok gayo ada?", "fresh-session");

    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.text()).toContain("Pesannya terlalu cepat");
    expect(model.doStreamCalls).toHaveLength(0);
    expect(store.conversations.map((c) => c.externalId)).not.toContain("fresh-session");
  });

  it("can't be dodged by starting a new conversation id", async () => {
    await exhaustMinute();

    const body = await (await chat(ASK_FOR_HUMAN, "another-session")).text();

    expect(body).toContain("Pesannya terlalu cepat");
  });

  it("says to come back tomorrow when a daily limit is the problem", async () => {
    store.hitCounts.set("all:day", { hits: CHAT_QUOTAS.allDay.limit, expiresAtMs: 86_400_000 });

    const response = await chat("is gayo in stock?");

    expect(await response.text()).toContain("tomorrow");
  });

  it("leaves a local Ollama setup alone", async () => {
    mocks.env = { AI_PROVIDER: "ollama", EMBEDDING_PROVIDER: "ollama" };

    for (let i = 0; i < CHAT_QUOTAS.perIpMinute.limit + 2; i++) {
      expect(await (await chat(ASK_FOR_HUMAN)).text()).not.toContain("terlalu cepat");
    }
    expect(store.hitCounts.size).toBe(0);
  });

  it("still limits when only the embeddings are hosted", async () => {
    mocks.env = { AI_PROVIDER: "ollama", EMBEDDING_PROVIDER: "google" };
    await exhaustMinute();

    expect(await (await chat(ASK_FOR_HUMAN)).text()).toContain("terlalu cepat");
  });
});
