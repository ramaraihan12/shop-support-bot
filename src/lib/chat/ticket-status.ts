import type { StreamTextTransform } from "ai";
import type { Language } from "./language";
import { replies } from "./replies";
import type { SupportTools } from "./tools";

// The word, or a code like TK-0001 or the lookalikes a model makes up
// (TKT-20261121-001). \b would miss "_tiket_", so the start is a lookbehind.
// Every quantifier is a single class, so nothing backtracks.
const TICKET_MENTION = /(?<![\p{L}\p{N}])(?:tiket|ticket|(?:TK|TKT|TCK|TIK)-?\d)/iu;

export const MAX_LISTED_TICKETS = 5;
export const LOOKUP_TIMEOUT_MS = 3000;

export function mentionsTicket(reply: string): boolean {
  return TICKET_MENTION.test(reply);
}

/**
 * The line says which tickets exist in this conversation, whatever the reply
 * claims, offers or quotes. That makes it true even when the model was right,
 * and it doubles as the system's own confirmation of a ticket it opened.
 * Returns null when the reply doesn't mention a ticket, when the lookup fails
 * or takes too long, or when the reply already ends with this exact line.
 */
export async function ticketStatusLine(input: {
  reply: string;
  language: Language;
  listTicketCodes: () => Promise<string[]>;
  timeoutMs?: number;
}): Promise<string | null> {
  const { reply, language } = input;
  if (!mentionsTicket(reply)) return null;

  let real: string[];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("ticket lookup timed out")), input.timeoutMs ?? LOOKUP_TIMEOUT_MS);
    });
    real = await Promise.race([input.listTicketCodes(), timeout]);
  } catch (error) {
    console.error("ticket lookup failed", error);
    return null;
  } finally {
    clearTimeout(timer);
  }

  const line =
    real.length === 0
      ? replies.ticketStatus.none(language)
      : replies.ticketStatus.open(language, real.slice(-MAX_LISTED_TICKETS));
  return reply.trimEnd().endsWith(line) ? null : line;
}

/**
 * Collects the text of every step. Before the last step finishes it adds the
 * status line as one more text part, so it ends up in that step's text: the
 * streamed reply, result.text and the saved message all carry it, and the
 * model's own text still streams as it comes.
 *
 * The loop goes on only when every tool call of a step got a result or an
 * error, so the last step is the first with no calls or with a call that got
 * no output, or step maxSteps. The finish reason can't tell: a provider may
 * say "stop" on a step whose loop goes on.
 */
export function ticketStatusTransform(options: {
  language: Language;
  maxSteps: number;
  listTicketCodes: () => Promise<string[]>;
  timeoutMs?: number;
}): StreamTextTransform<SupportTools> {
  return () => {
    const chunks: string[] = [];
    let stepsFinished = 0;
    let toolCalls = 0;
    let toolOutputs = 0;

    return new TransformStream({
      async transform(part, controller) {
        if (part.type === "text-delta") chunks.push(part.text);
        if (part.type === "text-end") chunks.push("\n");
        if (part.type === "tool-call") toolCalls++;
        if (part.type === "tool-result" || part.type === "tool-error") toolOutputs++;

        if (part.type === "finish-step") {
          stepsFinished++;
          const last = toolCalls === 0 || toolOutputs < toolCalls || stepsFinished >= options.maxSteps;
          toolCalls = 0;
          toolOutputs = 0;
          if (last) {
            const line = await ticketStatusLine({ reply: chunks.join(""), ...options });
            if (line) {
              controller.enqueue({ type: "text-start", id: "ticket-status" });
              controller.enqueue({ type: "text-delta", id: "ticket-status", text: `\n\n${line}` });
              controller.enqueue({ type: "text-end", id: "ticket-status" });
            }
          }
        }

        controller.enqueue(part);
      },
    });
  };
}
