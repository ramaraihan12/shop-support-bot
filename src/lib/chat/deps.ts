import { createEmbedder } from "@/lib/ai/embeddings";
import { chatProviderOptions, getChatModel, getEmbeddingModel } from "@/lib/ai/provider";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { createRateLimiter } from "@/lib/rate-limit";
import { createDbStore } from "@/lib/store/db-store";
import type { RespondDeps } from "./respond";

// Enough for a person typing, not enough for a script to keep the GPU busy.
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

const globalForDeps = globalThis as unknown as { respondDeps?: RespondDeps };

export function getRespondDeps(): RespondDeps {
  if (!globalForDeps.respondDeps) {
    const env = getEnv();
    globalForDeps.respondDeps = {
      store: createDbStore(getDb()),
      model: getChatModel(env),
      embed: createEmbedder(getEmbeddingModel(env)),
      limiter: createRateLimiter(RATE_LIMIT),
      providerOptions: chatProviderOptions(env),
    };
  }
  return globalForDeps.respondDeps;
}
