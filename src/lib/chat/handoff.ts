import type { Conversation, SupportStore } from "@/lib/store/types";

export type HandoffReason = "asked_for_human" | "upset";

const ASKED_FOR_HUMAN = [
  /\b(talk|speak|chat)\s+(to|with)\s+(a\s+)?(human|person|real person|agent|someone|staff|manager)\b/i,
  /\b(real|live)\s+(person|human|agent)\b/i,
  /\bhuman\s+(agent|support|please)\b/i,
  /\b(bicara|ngomong|ngobrol|chat|hubungkan|sambungkan|disambungkan|dihubungkan|minta|mau|pengen|ingin)\b.{0,20}\b(manusia|admin|cs|customer service|operator|petugas|orang asli)\b/i,
  /\b(bukan|jangan)\s+(bot|robot)\b/i,
];

const STRONG_ANGER = [
  /\b(scam|scammer|fraud|ripoff|rip-off|unacceptable|ridiculous|furious|wtf)\b/i,
  /\b(penipu|nipu|tipu|penipuan|brengsek|sialan|bangsat|anjing|goblok|bego|kecewa\s+(banget|berat|sekali))\b/i,
  /\b(gak|ga|nggak|tidak)\s+becus\b/i,
  /\b(lapor(in)?|laporkan|viralin|viralkan)\b.{0,30}\b(polisi|ylki|bpkn|sosmed|medsos|twitter|instagram|tiktok)\b/i,
];

const MILD_ANGER = [
  /\b(angry|annoyed|frustrated|disappointed|terrible|awful|useless|worst)\b/i,
  /\b(kecewa|kesal|kesel|marah|parah|lambat|lelet|ngecewain|zonk|capek)\b/i,
];

function isShouting(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 12 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7;
}

/**
 * Cheap first pass before the model sees the message. Small local models are
 * unreliable at noticing that someone is fed up, and asking for a human
 * should never depend on the model getting it right.
 */
export function detectHandoff(text: string): HandoffReason | null {
  if (ASKED_FOR_HUMAN.some((re) => re.test(text))) return "asked_for_human";
  if (STRONG_ANGER.some((re) => re.test(text))) return "upset";

  const mild = MILD_ANGER.some((re) => re.test(text));
  const loud = isShouting(text) || /[!?]{3,}/.test(text);
  if (mild && loud) return "upset";

  return null;
}

/** Flags the conversation for the team and opens a high-priority ticket. */
export async function startHandoff(
  store: SupportStore,
  conversation: Conversation,
  input: { reason: string; lastMessage: string; contact?: string },
): Promise<{ ticketCode: string }> {
  const ticket = await store.createTicket({
    conversationId: conversation.id,
    category: "handoff",
    priority: "high",
    subject: `Handoff requested (${conversation.channel})`,
    details: `${input.reason}\n\nLast customer message:\n${input.lastMessage}`,
    contact: input.contact,
  });
  await store.markHandoff(conversation.id);
  conversation.status = "handoff";
  return { ticketCode: ticket.code };
}
