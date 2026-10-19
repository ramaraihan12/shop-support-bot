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

  rateLimited: (lang: Language, retryAfterSeconds: number) =>
    lang === "id"
      ? `Pesannya terlalu cepat. Coba lagi dalam ${retryAfterSeconds} detik.`
      : `That's a lot of messages at once. Try again in ${retryAfterSeconds} seconds.`,

  modelFailed: (lang: Language) =>
    lang === "id"
      ? "Maaf, sistem kami sedang bermasalah. Coba lagi sebentar lagi."
      : "Sorry, something went wrong on our side. Please try again in a moment.",

  telegramStart:
    "Halo! Ini bantuan Kopi Nusantara. Tanya soal pesanan, stok, pengiriman, atau retur. You can write in English too.",
};
