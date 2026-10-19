import { embed, embedMany, type EmbeddingModel } from "ai";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";

export type EmbedFn = (text: string) => Promise<number[]>;

export function createEmbedder(model: EmbeddingModel): EmbedFn {
  return async (text) => {
    const { embedding } = await embed({ model, value: text, dimensions: EMBEDDING_DIMENSIONS });
    assertDimensions(embedding);
    return embedding;
  };
}

export async function embedAll(model: EmbeddingModel, texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model,
    values: texts,
    dimensions: EMBEDDING_DIMENSIONS,
    maxParallelCalls: 2,
  });
  embeddings.forEach(assertDimensions);
  return embeddings;
}

// pgvector rejects the insert anyway, but this error says what to change.
function assertDimensions(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}. ` +
        "Pick a model that supports 1024-dim output.",
    );
  }
}
