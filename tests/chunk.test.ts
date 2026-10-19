import { describe, expect, it } from "vitest";
import { chunkMarkdown, embeddingText } from "@/lib/rag/chunk";

const doc = `# Pengiriman

Intro paragraph before any section.

## Kurir

JNE dan SiCepat.

## Ongkos kirim

Gratis ongkir di atas Rp300.000.
`;

describe("chunkMarkdown", () => {
  it("makes one chunk per section with the document title in the heading", () => {
    const chunks = chunkMarkdown("pengiriman.md", doc);
    expect(chunks.map((c) => c.heading)).toEqual([
      "Pengiriman",
      "Pengiriman > Kurir",
      "Pengiriman > Ongkos kirim",
    ]);
    expect(chunks[1]?.content).toBe("JNE dan SiCepat.");
  });

  it("splits long sections on paragraph boundaries", () => {
    const paragraph = "kalimat ".repeat(40).trim();
    const long = `# Doc\n\n## Panjang\n\n${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const chunks = chunkMarkdown("doc.md", long, 500);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.heading === "Doc > Panjang")).toBe(true);
  });

  it("handles windows line endings", () => {
    const chunks = chunkMarkdown("x.md", doc.replace(/\n/g, "\r\n"));
    expect(chunks).toHaveLength(3);
  });
});

describe("embeddingText", () => {
  it("prefixes the heading so short sections still carry their topic", () => {
    expect(embeddingText({ source: "a.md", heading: "Pembayaran > QRIS", content: "Bisa." })).toBe(
      "Pembayaran > QRIS\n\nBisa.",
    );
  });
});
