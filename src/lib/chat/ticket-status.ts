import type { StreamTextTransform } from "ai";
import type { Language } from "./language";
import { replies } from "./replies";
import type { SupportTools } from "./tools";

// The word itself, or a code like TK-0001 or the lookalikes a model makes up
// (TKT-20261121-001). No backtracking: every quantifier is a single class.
const TICKET_WORD = /\b(?:tiket|ticket)/i;
const TICKET_CODE = /\b(?:TK|TKT|TCK|TIK|TIKET|TICKET)-?\d[\w-]*/gi;

export function mentionsTicket(reply: string): boolean {
  return TICKET_WORD.test(reply) || reply.search(TICKET_CODE) !== -1;
}

// "TK0001" and "tk-0001" are the same ticket.
const compareForm = (code: string) => code.toUpperCase().replaceAll("-", "");

/**
 * What the reply has to be checked against is the database, not the reply's
 * wording: whether it claims a ticket, offers one or quotes policy, the line
 * only states which tickets exist in this conversation.
 */
export async function ticketStatusLine(input: {
  reply: string;
  language: Language;
  listTicketCodes: () => Promise<string[]>;
}): Promise<string | null> {
  const { reply, language } = input;
  if (!mentionsTicket(reply)) return null;

  let real: string[];
  try {
    real = await input.listTicketCodes();
  } catch (error) {
    console.error("ticket lookup failed", error);
    return null;
  }

  const line = real.length === 0 ? replies.ticketStatus.none(language) : replies.ticketStatus.open(language, real);
  if (reply.trimEnd().endsWith(line)) return null;
  if (real.length === 0) return line;

  const quoted = (reply.match(TICKET_CODE) ?? []).map(compareForm);
  const known = new Set(real.map(compareForm));
  return quoted.length > 0 && quoted.every((code) => known.has(code)) ? null : line;
}

/**
 * Collects the text of every step. Before the last step finishes it adds the
 * status line as one more text part, so it ends up in that step's text: the
 * streamed reply, result.text and the saved message all carry it, and the
 * model's own text still streams as it comes.
 *
 * The last step is the first one without a tool call, or step maxSteps. The
 * finish reason can't tell: a provider may say "stop" on a step whose loop goes on.
 */
export function ticketStatusTransform(options: {
  language: Language;
  maxSteps: number;
  listTicketCodes: () => Promise<string[]>;
}): StreamTextTransform<SupportTools> {
  return () => {
    const chunks: string[] = [];
    let stepsFinished = 0;
    let toolCallInStep = false;

    return new TransformStream({
      async transform(part, controller) {
        if (part.type === "text-delta") chunks.push(part.text);
        if (part.type === "text-end") chunks.push("\n");
        if (part.type === "tool-call") toolCallInStep = true;

        if (part.type === "finish-step") {
          stepsFinished++;
          const last = !toolCallInStep || stepsFinished >= options.maxSteps;
          toolCallInStep = false;
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
