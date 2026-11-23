// Small models sometimes say a ticket is open, or about to be, without calling
// createTicket. These checks look at the reply text only; whether a tool
// really returned a code is decided by the caller.

// Ticket codes as the shop writes them (TK-0001) and the lookalikes a model
// makes up (TKT-20261121-001, "ticket #4821", "kode tiket: ABC123").
const PREFIXED_CODE = /\b(?:TK|TKT|TCK|TIK|TIKET|TICKET)-?\d[\w-]*/gi;
const HASH_CODE = /\b(?:tiket|ticket)\s*(?:no\.?|nomor|number)?\s*#\s*([\w-]*\d[\w-]*)/gi;
const LABELLED_CODE =
  /\b(?:kode\s+tiket\w*|(?:tiket|ticket)\s+(?:code|number|id|no\.?|nomor|kode))(?:\s+(?:anda|kamu|mu|your))?\s*(?:adalah|is|:)?\s*[*`"'#]*([a-z][\w-]*\d[\w-]*|\d{4,})/gi;

const normalizeCode = (code: string) => code.replace(/^#/, "").toUpperCase();

/** Ticket-looking codes in the text, in order, without repeats. */
export function extractTicketCodes(text: string): string[] {
  const found: { index: number; code: string }[] = [];
  for (const match of text.matchAll(PREFIXED_CODE)) found.push({ index: match.index, code: match[0] });
  for (const re of [HASH_CODE, LABELLED_CODE]) {
    for (const match of text.matchAll(re)) found.push({ index: match.index, code: match[1] ?? "" });
  }
  const codes = found.sort((a, b) => a.index - b.index).map((f) => normalizeCode(f.code));
  return [...new Set(codes)];
}

const ID_OPEN =
  "(?:membuatkan|membuat|buatkan|buat|membuka|bukakan|buka|dibuatkan|dibuat|dibukakan|dibuka|mencatat|catat|dicatat|mengajukan|ajukan|diajukan|menerbitkan|diterbitkan|mendaftarkan|daftarkan|didaftarkan)";
const EN_OPEN = "(?:open|create|file|raise|log|submit)";
const EN_OPENED = "(?:opened|created|filed|raised|logged|submitted)";
const TICKET = String.raw`\b(?:tiket|ticket)\w*`;
const APOSTROPHE = "[’']";

type ClaimPattern = { re: RegExp; future: boolean };

const CLAIMS: ClaimPattern[] = [
  // "Saya sudah membuka tiket", "I've opened a ticket"
  { re: new RegExp(String.raw`\b(?:sudah|telah|udah|berhasil|barusan)\b[^.!?\n]{0,30}?\b${ID_OPEN}\b[^.!?\n]{0,30}?${TICKET}`, "i"), future: false },
  { re: new RegExp(String.raw`\b(?:i|we)(?:${APOSTROPHE}ve| have)?\s+(?:just\s+|now\s+|already\s+)?${EN_OPENED}\b[^.!?\n]{0,30}?\bticket`, "i"), future: false },
  // "Tiket Anda telah dibuat", "Your ticket has been created"
  { re: new RegExp(String.raw`${TICKET}\b[^.!?\n]{0,30}?\b(?:dibuat|dibuka|dibuatkan|dibukakan|diterbitkan|tercatat|terdaftar|diajukan)\b`, "i"), future: false },
  { re: new RegExp(String.raw`\bticket\b[^.!?\n]{0,30}?\b(?:has been|have been|was|is now|is)\s+(?:successfully\s+)?${EN_OPENED}\b`, "i"), future: false },
  // "Saya buatkan tiketnya sekarang"
  { re: new RegExp(String.raw`\bsaya\s+(?:bantu\s+)?(?:buat|buatkan|bukakan|buka)\s+(?:\w+\s+)?${TICKET}`, "i"), future: false },
  // "Saya akan segera membuatkan tiket", "I'll open a ticket", "I'm creating a ticket"
  { re: new RegExp(String.raw`\b(?:akan|segera|sedang|langsung|lagi)\b[^.!?\n]{0,25}?\b${ID_OPEN}\b[^.!?\n]{0,25}?${TICKET}`, "i"), future: true },
  { re: new RegExp(String.raw`\b(?:i${APOSTROPHE}ll|i will|we${APOSTROPHE}ll|we will|i am going to|i${APOSTROPHE}m going to|let me)\s+(?:\w+\s+)?${EN_OPEN}\b[^.!?\n]{0,25}?\bticket`, "i"), future: true },
  { re: new RegExp(String.raw`\bi(?:${APOSTROPHE}m| am)\s+(?:now\s+|currently\s+)?(?:opening|creating|filing|raising|logging|submitting)\b[^.!?\n]{0,25}?\bticket`, "i"), future: true },
];

// A condition earlier in the sentence turns it into an offer ("kalau kamu
// kirim email, saya buatkan tiketnya"). "Can/bisa" only counts in the same
// clause, so "kamu bisa tenang, saya sudah membuka tiket" is still a claim.
const CONDITION = /\b(?:kalau|jika|bila|apabila|sebelum|setelah|begitu|agar|supaya|biar|asalkan|if|once|after|before|when|unless|whether|provided)\b/i;
const MODAL = /\b(?:bisa|dapat|boleh|mau|ingin|perlu|harus|silakan|silahkan|can|could|may|might|would|should|want|need|must)\b/i;

function isOffer(sentence: string, pattern: ClaimPattern, index: number): boolean {
  const before = sentence.slice(0, index);
  const clause = before.slice(Math.max(before.lastIndexOf(","), before.lastIndexOf(";"), before.lastIndexOf(":")) + 1);
  if (CONDITION.test(before) || MODAL.test(clause)) return true;
  // "Saya akan buatkan tiket setelah kamu kirim email"
  return pattern.future && CONDITION.test(sentence.slice(index));
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());
}

const isQuestion = (sentence: string) => /\?[\s*_"')\]]*$/.test(sentence);

export type TicketClaim = {
  /** The reply says a ticket is open or being opened. */
  claimsTicket: boolean;
  /** Ticket codes in the reply that nobody gave in this conversation. */
  unknownCodes: string[];
};

/**
 * Checks one reply. `knownCodes` are the codes the customer typed, an earlier
 * message gave, or a tool returned. A sentence that quotes one of them talks
 * about a ticket that already exists, so it isn't a claim.
 */
export function findTicketClaim(reply: string, knownCodes: Iterable<string>): TicketClaim {
  const known = new Set([...knownCodes].map(normalizeCode));

  const claimsTicket = splitSentences(reply).some((sentence) => {
    if (isQuestion(sentence) || extractTicketCodes(sentence).some((code) => known.has(code))) return false;
    return CLAIMS.some((pattern) => {
      const match = pattern.re.exec(sentence);
      return match !== null && !isOffer(sentence, pattern, match.index);
    });
  });

  return { claimsTicket, unknownCodes: extractTicketCodes(reply).filter((code) => !known.has(code)) };
}
