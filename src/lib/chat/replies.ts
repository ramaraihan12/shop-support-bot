import type { Language } from "./language";

// Answers that don't go through the model, so they are always the same.
export const replies = {
  handoff: (lang: Language, ticketCode: string) =>
    lang === "id"
      ? `Maaf atas ketidaknyamanannya. Percakapan ini sudah saya teruskan ke tim CS kami (tiket ${ticketCode}). Mereka aktif Senin-Sabtu 09.00-17.00 WIB. Supaya bisa dibalas, tulis email atau nomor WhatsApp kamu di sini, ya.`
      : `Sorry about the trouble. I've passed this conversation to our support team (ticket ${ticketCode}). They're online Monday to Saturday, 09:00-17:00 WIB. Leave your email or WhatsApp number here so they can get back to you.`,

  waitingForHuman: (lang: Language) =>
    lang === "id"
      ? "Pesan kamu sudah tercatat. Tim CS kami akan membalas di jam kerja (Senin-Sabtu 09.00-17.00 WIB)."
      : "Got it, your message is saved. Our support team will reply during working hours (Monday to Saturday, 09:00-17:00 WIB).",

  // Added when a model reply talks about a ticket that no tool opened. It has
  // to be true even if the check was wrong, and the quoted phrase has to be
  // one that detectHandoff() matches (tests/ticket-claims.test.ts checks it).
  noTicketOpened: (lang: Language) =>
    lang === "id"
      ? 'Catatan: balasan ini tidak membuka tiket apa pun, jadi abaikan kode tiket baru di balasan ini. Supaya tiket benar-benar terbuka, tulis "hubungkan ke admin".'
      : 'Note: this reply did not open a ticket, so ignore any new ticket code in it. To get a real ticket opened, write "talk to a person".',

  otherCodesNotValid: (lang: Language, openedCodes: string[]) =>
    lang === "id"
      ? `Catatan: tiket yang benar-benar dibuka di balasan ini hanya ${openedCodes.join(", ")}. Kode tiket lain di balasan ini tidak berlaku.`
      : `Note: the only ticket actually opened in this reply is ${openedCodes.join(", ")}. Any other ticket code in it is not valid.`,

  rateLimited: (lang: Language, retryAfterSeconds: number) =>
    lang === "id"
      ? `Pesannya terlalu cepat. Coba lagi dalam ${retryAfterSeconds} detik.`
      : `That's a lot of messages at once. Try again in ${retryAfterSeconds} seconds.`,

  dailyLimit: (lang: Language) =>
    lang === "id"
      ? "Demo ini sudah mencapai batas pesan harian. Coba lagi besok, ya."
      : "This demo has reached its daily message limit. Please try again tomorrow.",

  modelFailed: (lang: Language) =>
    lang === "id"
      ? "Maaf, sistem kami sedang bermasalah. Coba lagi sebentar lagi."
      : "Sorry, something went wrong on our side. Please try again in a moment.",

  telegramStart:
    "Halo! Ini bantuan Kopi Nusantara. Tanya soal pesanan, stok, pengiriman, atau retur. You can write in English too.",
};
