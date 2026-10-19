import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmbedder } from "@/lib/ai/embeddings";
import { getEmbeddingModel } from "@/lib/ai/provider";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";
import type { Env } from "@/lib/env";

const env: Env = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/shop_support",
  AI_PROVIDER: "ollama",
  AI_MODEL: undefined,
  EMBEDDING_PROVIDER: "ollama",
  EMBEDDING_MODEL: undefined,
  OLLAMA_BASE_URL: "http://localhost:11434/api",
  TELEGRAM_BOT_TOKEN: undefined,
  TELEGRAM_WEBHOOK_SECRET: undefined,
  ADMIN_USER: "admin",
  ADMIN_PASSWORD: undefined,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ollama embeddings", () => {
  it("asks for a small context instead of the server default", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        model: "qwen3-embedding:0.6b",
        embeddings: [Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.01)],
        total_duration: 1,
        load_duration: 1,
        prompt_eval_count: 4,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createEmbedder(getEmbeddingModel(env))("ongkir ke Bali");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/embed");
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "qwen3-embedding:0.6b",
      input: ["ongkir ke Bali"],
      options: { num_ctx: 2048 },
    });
  });
});
