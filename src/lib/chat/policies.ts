import type { EmbedFn } from "@/lib/ai/embeddings";
import type { SupportStore } from "@/lib/store/types";

// Below this the chunk is usually about something else entirely.
const MIN_POLICY_SIMILARITY = 0.35;

export type PolicyExcerpt = { section: string; text: string };

export async function findPolicies(
  store: SupportStore,
  embed: EmbedFn,
  query: string,
  limit: number,
): Promise<PolicyExcerpt[]> {
  const matches = await store.searchPolicies(await embed(query), limit);
  return matches
    .filter((m) => m.similarity >= MIN_POLICY_SIMILARITY)
    .map((m) => ({ section: m.heading, text: m.content }));
}
