import { isStepCount, streamText, type LanguageModel, type ModelMessage } from "ai";
import type { EmbedFn } from "@/lib/ai/embeddings";
import type { RateLimiter } from "@/lib/rate-limit";
import type { Channel, Conversation, StoredMessage, SupportStore } from "@/lib/store/types";
import { detectHandoff, startHandoff } from "./handoff";
import { buildInstructions } from "./instructions";
import { detectLanguage, type Language } from "./language";
import { replies } from "./replies";
import { createSupportTools } from "./tools";

export const HISTORY_LIMIT = 20;
export const MAX_STEPS = 6;
// A support question fits easily. Longer pastes get cut so one message
// can't fill the model's context.
export const MAX_MESSAGE_CHARS = 1000;

type StreamOptions = Parameters<typeof streamText>[0];

export type RespondDeps = {
  store: SupportStore;
  model: LanguageModel;
  embed: EmbedFn;
  limiter: RateLimiter;
  providerOptions?: StreamOptions["providerOptions"];
  now?: () => Date;
};

export type IncomingMessage = {
  channel: Channel;
  externalId: string;
  text: string;
};

export type Reply =
  | { kind: "rate_limited"; text: string; retryAfterSeconds: number }
  | { kind: "handoff"; text: string }
  | { kind: "model"; result: ReturnType<typeof streamModelReply>; language: Language };

/**
 * One customer message in, one reply out. Shared by the web chat and the
 * Telegram webhook so both channels get the same guardrails.
 */
export async function respond(deps: RespondDeps, incoming: IncomingMessage): Promise<Reply> {
  const { store, limiter } = deps;
  const { channel, externalId } = incoming;
  const text = incoming.text.trim().slice(0, MAX_MESSAGE_CHARS);
  const language = detectLanguage(text);

  const limit = limiter.check(`${channel}:${externalId}`);
  if (!limit.allowed) {
    return {
      kind: "rate_limited",
      text: replies.rateLimited(language, limit.retryAfterSeconds),
      retryAfterSeconds: limit.retryAfterSeconds,
    };
  }

  const conversation = await store.getOrCreateConversation(channel, externalId);
  const history = await store.getRecentMessages(conversation.id, HISTORY_LIMIT);
  await store.saveMessage(conversation.id, { role: "user", content: text });

  const handoffReply = async (answer: string) => {
    await store.saveMessage(conversation.id, { role: "assistant", content: answer });
    return { kind: "handoff" as const, text: answer };
  };

  // Once a person owns the conversation the bot stays out of it.
  if (conversation.status === "handoff") {
    return handoffReply(replies.waitingForHuman(language));
  }

  const handoffReason = detectHandoff(text);
  if (handoffReason) {
    const { ticketCode } = await startHandoff(store, conversation, {
      reason: handoffReason === "asked_for_human" ? "Customer asked for a person." : "Customer sounds upset.",
      lastMessage: text,
    });
    return handoffReply(replies.handoff(language, ticketCode));
  }

  const result = streamModelReply(deps, conversation, history, text);
  return { kind: "model", result, language };
}

function streamModelReply(
  deps: RespondDeps,
  conversation: Conversation,
  history: StoredMessage[],
  text: string,
) {
  const messages: ModelMessage[] = [
    ...history.map((m): ModelMessage => ({ role: m.role, content: m.content })),
    { role: "user", content: text },
  ];

  return streamText({
    model: deps.model,
    instructions: buildInstructions(deps.now?.()),
    messages,
    tools: createSupportTools({
      store: deps.store,
      conversation,
      embed: deps.embed,
      lastUserMessage: text,
    }),
    stopWhen: isStepCount(MAX_STEPS),
    // On the last step, force an answer instead of yet another tool call.
    prepareStep: ({ stepNumber }) => (stepNumber === MAX_STEPS - 1 ? { toolChoice: "none" } : {}),
    providerOptions: deps.providerOptions,
    onEnd: async ({ text: answer, toolCalls }) => {
      if (!answer.trim()) return;
      await deps.store.saveMessage(conversation.id, {
        role: "assistant",
        content: answer,
        toolCalls: toolCalls.map((call) => call.toolName),
      });
    },
  });
}
