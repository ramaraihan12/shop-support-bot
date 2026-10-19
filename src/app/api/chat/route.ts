import { createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { z } from "zod";
import { getRespondDeps } from "@/lib/chat/deps";
import { replies } from "@/lib/chat/replies";
import { respond } from "@/lib/chat/respond";

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

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
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

  const reply = await respond(getRespondDeps(), { channel: "web", externalId: parsed.data.id, text });

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
