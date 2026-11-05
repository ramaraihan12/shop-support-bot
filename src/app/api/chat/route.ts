import { createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { z } from "zod";
import { getRespondDeps } from "@/lib/chat/deps";
import { detectLanguage } from "@/lib/chat/language";
import { checkChatQuota, clientIp, MAX_BODY_BYTES } from "@/lib/chat/quota";
import { replies } from "@/lib/chat/replies";
import { MAX_MESSAGE_CHARS, respond } from "@/lib/chat/respond";
import { getEnv } from "@/lib/env";

// Local models on a laptop GPU can take a while with a couple of tool calls.
export const maxDuration = 120;

// The client only sends its newest message. History comes from the database,
// so a tampered request can't rewrite what the bot said earlier.
const requestSchema = z.object({
  id: z.string().min(8).max(64),
  message: z.object({
    role: z.literal("user"),
    parts: z.array(z.object({ type: z.string(), text: z.string().optional() })).min(1),
  }),
});

const tooLarge = () => Response.json({ error: "Message is too long" }, { status: 413 });

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return tooLarge();
  const body = await request.text();
  // Content-Length can be missing or wrong, so check what actually arrived.
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return tooLarge();

  const parsed = requestSchema.safeParse(parseJson(body));
  if (!parsed.success) {
    return Response.json({ error: "Invalid chat request" }, { status: 400 });
  }

  const text = parsed.data.message.parts
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("\n")
    .trim();
  if (!text) {
    return Response.json({ error: "Message is empty" }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_CHARS) return tooLarge();

  const deps = getRespondDeps();

  // A local model has no quota to run out of.
  const { AI_PROVIDER, EMBEDDING_PROVIDER } = getEnv();
  if (AI_PROVIDER !== "ollama" || EMBEDDING_PROVIDER !== "ollama") {
    const quota = await checkChatQuota(deps.store, clientIp(request.headers));
    if (!quota.allowed) {
      const language = detectLanguage(text);
      return createUIMessageStreamResponse({
        stream: fixedTextStream(
          quota.window === "minute"
            ? replies.rateLimited(language, quota.retryAfterSeconds)
            : replies.dailyLimit(language),
        ),
        headers: { "Retry-After": String(quota.retryAfterSeconds) },
      });
    }
  }

  const reply = await respond(deps, { channel: "web", externalId: parsed.data.id, text });

  if (reply.kind === "model") {
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: reply.result.stream,
        onError: (error) => {
          console.error("chat model failed", error);
          return replies.modelFailed(reply.language);
        },
      }),
    });
  }

  return createUIMessageStreamResponse({
    stream: fixedTextStream(reply.text),
    headers: reply.kind === "rate_limited" ? { "Retry-After": String(reply.retryAfterSeconds) } : undefined,
  });
}

/** Sends a canned reply in the same stream format as a model answer. */
function fixedTextStream(text: string) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "reply" });
      writer.write({ type: "text-delta", id: "reply", delta: text });
      writer.write({ type: "text-end", id: "reply" });
      writer.write({ type: "finish" });
    },
  });
}
