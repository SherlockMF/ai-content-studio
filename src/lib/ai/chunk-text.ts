/** 按 Markdown 章节切分，控制单段长度利于模型稳定输出 */
export function splitMarkdownForRewrite(body: string, maxChunkChars = 2200): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChunkChars) return [trimmed];

  const sections = trimmed.split(/(?=^#{1,3}\s)/m).filter(Boolean);
  if (sections.length <= 1) {
    return hardSplitByParagraph(trimmed, maxChunkChars);
  }

  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    const next = current ? `${current}\n\n${section}` : section;
    if (next.length > maxChunkChars && current.trim()) {
      chunks.push(current.trim());
      current = section;
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.flatMap((chunk) =>
    chunk.length > maxChunkChars ? hardSplitByParagraph(chunk, maxChunkChars) : [chunk]
  );
}

function hardSplitByParagraph(text: string, maxChunkChars: number): string[] {
  if (text.length <= maxChunkChars) return [text];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const next = current ? `${current}\n\n${para}` : para;
    if (next.length > maxChunkChars && current.trim()) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = next;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  if (chunks.length === 1 && chunks[0].length > maxChunkChars) {
    const parts: string[] = [];
    for (let i = 0; i < chunks[0].length; i += maxChunkChars) {
      parts.push(chunks[0].slice(i, i + maxChunkChars));
    }
    return parts;
  }

  return chunks;
}
