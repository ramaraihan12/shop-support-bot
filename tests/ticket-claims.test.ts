import { describe, expect, it } from "vitest";
import { detectHandoff } from "@/lib/chat/handoff";
import { replies } from "@/lib/chat/replies";
import { extractTicketCodes, findTicketClaim } from "@/lib/chat/ticket-claims";

const claims = (text: string, known: string[] = []) => findTicketClaim(text, known).claimsTicket;

describe("findTicketClaim: replies that say a ticket exists", () => {
  it.each([
    "Saya sudah membuka tiket untuk laporan kemasan sobek. Tim kami akan menghubungi kamu.",
    "Saya akan segera membuatkan tiket dukungan untuk kasus ini. Silakan tunggu email konfirmasi dengan kode tiketnya.",
    "Baik, saya akan langsung membuka tiket untuk tim kami.",
    "Tiket Anda telah dibuat dengan kode **TKT-20261121-001**.",
    "Saya buatkan tiketnya sekarang ya.",
    "Tiket sudah dibuat, tim kami membalas di jam kerja.",
    "I've opened a ticket for the torn packaging.",
    "I have created a ticket for you and the team will reply by email.",
    "I'll open a ticket for the team right away.",
    "I'm creating a ticket now.",
    "Your ticket has been created.",
    "Let me open a ticket for you.",
    "Pesanan ada di jalan. Saya sudah buatkan tiket untuk kamu.",
  ])("flags: %s", (text) => {
    expect(claims(text)).toBe(true);
  });

  it("flags a claim in the middle of a longer reply", () => {
    const reply = "Maaf soal kemasannya.\n\nSaya sudah membuka tiket untuk kamu.\nAda lagi yang bisa dibantu?";
    expect(claims(reply)).toBe(true);
  });

  it("flags a claim that follows an earlier 'bisa' in another clause", () => {
    expect(claims("Kamu bisa tenang, saya sudah membuka tiket.")).toBe(true);
  });
});

describe("findTicketClaim: offers, questions and policy text are not claims", () => {
  it.each([
    "Sebelum saya buatkan tiket, apakah Anda sudah memiliki video unboxing? Dengan video itu, agar saya bisa langsung buat tiket untuk Anda.",
    "Sebelum saya buatkan tiket, apakah Anda sudah memiliki video unboxing?",
    "Agar saya bisa langsung buat tiket untuk Anda, kirim emailnya dulu.",
    "Mau saya buatkan tiket?",
    "Saya buatkan tiketnya ya?",
    "Kalau kamu kirim email, saya buatkan tiketnya.",
    "Saya bisa buatkan tiket kalau kamu kirim email.",
    "Saya akan buatkan tiket setelah kamu kirim email dan nomor pesanan.",
    "Boleh minta email supaya saya bisa membuka tiket?",
    "I can open a ticket for you if you share your email.",
    "Would you like me to open a ticket?",
    "Want me to create a ticket for this?",
    "Once you send your email I'll open a ticket.",
    "I'll open a ticket after you share your email.",
    "Kamu bisa membuka tiket lewat email cs@kopinusantara.example.",
    "Jika barang rusak, buka tiket dalam 2 hari. Tiket dibalas dalam 1x24 jam kerja.",
    "Tickets are answered within one working day.",
    "Pesanan KN-10234 sudah dikirim lewat SiCepat.",
    "Hello, how can I help?",
  ])("does not flag: %s", (text) => {
    expect(claims(text)).toBe(false);
  });
});

describe("findTicketClaim: ticket codes", () => {
  it("extracts codes in the shapes a model writes them", () => {
    expect(extractTicketCodes("Kode: **TKT-20261121-001**, atau TK-0001.")).toEqual(["TKT-20261121-001", "TK-0001"]);
    expect(extractTicketCodes("Your ticket #48213 is open")).toEqual(["48213"]);
    expect(extractTicketCodes("kode tiket Anda: ABC12345")).toEqual(["ABC12345"]);
  });

  it("ignores order numbers and ordinary words", () => {
    expect(extractTicketCodes("Pesanan KN-10234 dikirim. Tiket dibalas dalam 24 jam.")).toEqual([]);
  });

  it("reports a code nobody gave as unknown, even without a claim sentence", () => {
    const result = findTicketClaim("Kode tiket kamu: TK-0042.", []);
    expect(result.unknownCodes).toEqual(["TK-0042"]);
  });

  it("accepts a code the customer, or an earlier assistant message, already gave", () => {
    expect(findTicketClaim("Tiket TK-0042 masih diproses.", ["tk-0042"]).unknownCodes).toEqual([]);
  });
});

describe("the note and the handoff detector", () => {
  const quoted = (note: string) => [...note.matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");

  it.each(["id", "en"] as const)("every phrase quoted in the %s note really starts a handoff", (language) => {
    const phrases = quoted(replies.noTicketOpened(language));
    expect(phrases.length).toBeGreaterThan(0);
    for (const phrase of phrases) expect(detectHandoff(phrase)).toBe("asked_for_human");
  });

  it.each(["id", "en"] as const)("the %s note for a real ticket quotes no phrase", (language) => {
    expect(quoted(replies.otherCodesNotValid(language, ["TK-0007"]))).toEqual([]);
  });
});
