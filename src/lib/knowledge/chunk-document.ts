import { KnowledgeChunk } from "@/types/domain";

const DEFAULT_MAX_CHARS = 1_200;
const DEFAULT_OVERLAP_CHARS = 120;

function splitLongParagraph(paragraph: string, maxChars: number, overlapChars: number) {
  const parts: string[] = [];
  const step = Math.max(1, maxChars - overlapChars);
  for (let start = 0; start < paragraph.length; start += step) {
    parts.push(paragraph.slice(start, start + maxChars));
    if (start + maxChars >= paragraph.length) break;
  }
  return parts;
}

export function chunkKnowledgeText(
  text: string,
  documentId: string,
  workspaceId = "ws_demo",
  options?: { maxChars?: number; overlapChars?: number }
): KnowledgeChunk[] {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = Math.min(options?.overlapChars ?? DEFAULT_OVERLAP_CHARS, maxChars / 3);
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) =>
      item.length > maxChars ? splitLongParagraph(item, maxChars, overlapChars) : [item]
    );

  const bodies: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) bodies.push(current);
    current = paragraph;
  }
  if (current) bodies.push(current);

  const createdAt = new Date().toISOString();
  return bodies.map((content, order) => ({
    id: `${documentId}_chunk_${order + 1}`,
    documentId,
    workspaceId,
    order,
    content,
    createdAt,
  }));
}
