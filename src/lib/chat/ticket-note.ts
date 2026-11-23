import type { StreamTextTransform } from "ai";
import type { Language } from "./language";
import { replies } from "./replies";
import { extractTicketCodes, findTicketClaim } from "./ticket-claims";
import type { SupportTools } from "./tools";

/** The note to add to a finished reply, or null when the reply is fine. */
export function ticketNoteFor(input: {
  reply: string;
  language: Language;
  /** Text the customer or an earlier assistant message already put in the conversation. */
  knownText: string[];
  /** Codes that createTicket or handoffToHuman returned in this turn. */
  openedCodes: string[];
}): string | null {
  const { reply, language, knownText, openedCodes } = input;
  const known = [...knownText.flatMap(extractTicketCodes), ...openedCodes];
  const { claimsTicket, unknownCodes } = findTicketClaim(reply, known);

  if (openedCodes.length > 0) {
    return unknownCodes.length > 0 ? replies.otherCodesNotValid(language, openedCodes) : null;
  }
  return claimsTicket || unknownCodes.length > 0 ? replies.noTicketOpened(language) : null;
}

/**
 * Collects the text of every step and the ticket codes the tools returned.
 * Right before the last step finishes it adds the note as one more text part,
 * so it ends up in that step's text: the streamed reply, result.text and the
 * saved message all carry it, and the model's own text still streams as it comes.
 */
export function ticketNoteTransform(options: {
  language: Language;
  knownText: string[];
}): StreamTextTransform<SupportTools> {
  return () => {
    let reply = "";
    const openedCodes: string[] = [];

    return new TransformStream({
      transform(part, controller) {
        if (part.type === "text-delta") reply += part.text;
        if (part.type === "text-end") reply += "\n";

        if (part.type === "tool-result" && (part.toolName === "createTicket" || part.toolName === "handoffToHuman")) {
          const output: unknown = part.output;
          if (typeof output === "object" && output && "ticketCode" in output && typeof output.ticketCode === "string") {
            openedCodes.push(output.ticketCode);
          }
        }

        if (part.type === "finish-step" && part.finishReason !== "tool-calls") {
          const note = ticketNoteFor({ reply, openedCodes, ...options });
          if (note) {
            controller.enqueue({ type: "text-start", id: "ticket-note" });
            controller.enqueue({ type: "text-delta", id: "ticket-note", text: `\n\n${note}` });
            controller.enqueue({ type: "text-end", id: "ticket-note" });
          }
        }

        controller.enqueue(part);
      },
    });
  };
}
