export type PolicyChunk = {
  source: string;
  heading: string;
  content: string;
};

/**
 * Splits a policy document on its `##` sections. Policy sections are short,
 * so one section is usually one chunk; long ones get split on paragraphs.
 */
export function chunkMarkdown(source: string, markdown: string, maxChars = 900): PolicyChunk[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let title = source;
  let section: string | undefined;
  let buffer: string[] = [];
  const chunks: PolicyChunk[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    const heading = section ? `${title} > ${section}` : title;
    for (const piece of splitParagraphs(text, maxChars)) {
      chunks.push({ source, heading, content: piece });
    }
  };

  for (const line of lines) {
    const h1 = /^#\s+(.+)$/.exec(line);
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h1?.[1]) {
      flush();
      title = h1[1].trim();
      section = undefined;
    } else if (h2?.[1]) {
      flush();
      section = h2[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  return chunks;
}

function splitParagraphs(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const pieces: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length + 2 > maxChars) {
      pieces.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** The text that actually gets embedded. The heading helps short sections match. */
export function embeddingText(chunk: PolicyChunk): string {
  return `${chunk.heading}\n\n${chunk.content}`;
}
