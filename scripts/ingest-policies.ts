import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { embedAll } from "@/lib/ai/embeddings";
import { getEmbeddingModel } from "@/lib/ai/provider";
import { createDb } from "@/lib/db";
import { policyChunks } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { chunkMarkdown, embeddingText, type PolicyChunk } from "@/lib/rag/chunk";

const POLICY_DIR = path.join(process.cwd(), "content", "policies");

async function main() {
  const env = getEnv();
  const files = (await readdir(POLICY_DIR)).filter((f) => f.endsWith(".md")).sort();

  const chunks: PolicyChunk[] = [];
  for (const file of files) {
    const markdown = await readFile(path.join(POLICY_DIR, file), "utf8");
    chunks.push(...chunkMarkdown(file, markdown));
  }
  if (chunks.length === 0) throw new Error(`No markdown files found in ${POLICY_DIR}`);

  console.log(`Embedding ${chunks.length} chunks from ${files.length} files...`);
  const started = Date.now();
  const embeddings = await embedAll(getEmbeddingModel(env), chunks.map(embeddingText));

  const { db, client } = createDb(env.DATABASE_URL);
  // Small corpus, so a full replace keeps it simple and avoids stale chunks.
  await db.transaction(async (tx) => {
    await tx.delete(policyChunks);
    await tx.insert(policyChunks).values(
      chunks.map((chunk, i) => ({ ...chunk, embedding: embeddings[i]! })),
    );
  });
  await client.end();

  console.log(`Stored ${chunks.length} chunks in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
