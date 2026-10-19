export type Language = "id" | "en";

const INDONESIAN = new Set([
  "saya", "aku", "kamu", "kak", "min", "apa", "apakah", "yang", "dan", "tidak", "nggak", "gak", "ga",
  "enggak", "sudah", "udah", "belum", "bisa", "mau", "pesanan", "pesan", "kirim", "dikirim", "berapa",
  "kapan", "dong", "sih", "ya", "gimana", "bagaimana", "terima", "kasih", "makasih", "tolong", "ada",
  "ini", "itu", "dengan", "untuk", "buat", "di", "ke", "dari", "sampai", "lama", "harga", "stok",
  "halo", "selamat", "pagi", "siang", "sore", "malam", "kenapa", "masih", "paket", "barang", "minta",
]);

const ENGLISH = new Set([
  "i", "my", "me", "you", "the", "a", "an", "is", "are", "was", "what", "when", "how", "where", "why",
  "can", "could", "do", "does", "did", "please", "ship", "shipping", "thanks", "thank", "hi", "hello",
  "to", "for", "with", "it", "this", "that", "not", "yet", "still", "package", "arrived", "long",
  "price", "have", "want", "need", "would", "of", "and", "or", "your",
]);

/**
 * Word-count guess at whether a message is Indonesian or English. Used for
 * canned replies and as an explicit hint to the model, which otherwise tends
 * to drift into Indonesian once the policy text or history is Indonesian.
 */
export function detectLanguage(text: string, fallback: Language = "id"): Language {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  let id = 0;
  let en = 0;
  for (const word of words) {
    if (INDONESIAN.has(word)) id++;
    if (ENGLISH.has(word)) en++;
  }
  if (id === en) return fallback;
  return id > en ? "id" : "en";
}
