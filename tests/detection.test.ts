import { describe, expect, it } from "vitest";
import { detectHandoff } from "@/lib/chat/handoff";
import { detectLanguage } from "@/lib/chat/language";

describe("detectHandoff", () => {
  it.each([
    "Can I talk to a human please",
    "I want to speak with a real person",
    "mau ngomong sama admin aja",
    "tolong sambungkan ke CS",
    "bisa bicara dengan manusia?",
    "jangan bot dong",
  ])("treats %j as asking for a person", (text) => {
    expect(detectHandoff(text)).toBe("asked_for_human");
  });

  it.each([
    "ini penipuan ya? udah seminggu belum sampai",
    "kecewa banget sama pelayanannya",
    "This is a scam, where is my order",
    "adminnya gak becus",
    "KENAPA PAKETNYA BELUM SAMPAI JUGA, KECEWA",
    "lambat banget!!!",
  ])("treats %j as upset", (text) => {
    expect(detectHandoff(text)).toBe("upset");
  });

  it.each([
    "Pesanan KN-10234 sudah sampai mana?",
    "What's the worst case delivery time to Bali?",
    "Do you ship to Papua?",
    "Kopi Gayo enak parah, mau beli lagi",
    "Jam berapa CS buka?",
    "kecewa dikit karena stok Kintamani habis",
    "mau tanya, CS buka jam berapa?",
    "mau pesan 2 bungkus ya admin",
    "minta nomor rekening admin dong",
    "Kopi Toraja parah enak!!!",
    "ini enak banget anjing",
  ])("leaves %j to the bot", (text) => {
    expect(detectHandoff(text)).toBeNull();
  });
});

describe("detectLanguage", () => {
  it.each([
    ["Halo kak, pesanan saya sudah dikirim belum?", "id"],
    ["Stok Gayo masih ada?", "id"],
    ["Hi, where is my order?", "en"],
    ["Do you ship to Bali and how long does it take?", "en"],
  ] as const)("%j -> %s", (text, expected) => {
    expect(detectLanguage(text)).toBe(expected);
  });

  it("falls back when it can't tell", () => {
    expect(detectLanguage("KN-10234", "en")).toBe("en");
  });
});
