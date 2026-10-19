import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import type { Env } from "@/lib/env";

const DEFAULT_CHAT_MODELS = {
  ollama: "qwen3.5:9b",
  openai: "gpt-5.4-mini",
  google: "gemini-3.5-flash",
  anthropic: "claude-haiku-5-5",
} as const;

const DEFAULT_EMBEDDING_MODELS = {
  ollama: "qwen3-embedding:0.6b",
  openai: "text-embedding-3-small",
  google: "gemini-embedding-001",
} as const;

export function getChatModel(env: Env): LanguageModel {
  const modelId = env.AI_MODEL ?? DEFAULT_CHAT_MODELS[env.AI_PROVIDER];
  switch (env.AI_PROVIDER) {
    case "ollama":
      return createOllama({ baseURL: env.OLLAMA_BASE_URL })(modelId);
    case "openai":
      return openai(modelId);
    case "google":
      return google(modelId);
    case "anthropic":
      return anthropic(modelId);
  }
}

export function getEmbeddingModel(env: Env): EmbeddingModel {
  const modelId = env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODELS[env.EMBEDDING_PROVIDER];
  switch (env.EMBEDDING_PROVIDER) {
    case "ollama":
      return createOllama({ baseURL: env.OLLAMA_BASE_URL }).embedding(modelId);
    case "openai":
      return openai.embedding(modelId);
    case "google":
      return google.embedding(modelId);
  }
}

/**
 * Qwen 3.5 and friends think before answering by default. For a support chat
 * on a laptop GPU that roughly triples the wait for no visible gain.
 */
export function chatProviderOptions(env: Env) {
  return env.AI_PROVIDER === "ollama" ? { ollama: { think: false } } : undefined;
}
