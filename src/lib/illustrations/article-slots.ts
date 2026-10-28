export interface ArticleSlot {
  alt: string;
  url: string;
  prompt: string;
  prompts: string[];
  promptEnd: number;
  embeddedImages: Array<{ markdown: string; url: string }>;
  start: number;
  end: number;
  source: string;
}

export function extractArticleSlots(body: string): ArticleSlot[] {
  const visible = body.replace(/<!--[\s\S]*?-->|^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*(?:\n|$)|`[^`\n]*`/gm, match => match.replace(/[^\n]/g, " "));
  const slots: ArticleSlot[] = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (const match of visible.matchAll(re)) {
    const start = match.index;
    const end = start + match[0].length;
    let promptEnd = end;
    const prompts: string[] = [];
    const embeddedImages: ArticleSlot["embeddedImages"] = [];
    while (true) {
      const rest = body.slice(promptEnd);
      const comment = rest.match(/^\s*<!--\s*(?:公众号封面 GPT 提示词|GPT 配图提示词)[^\n]*\n([\s\S]*?)-->/);
      const inline = rest.match(/^\s*\*\*(?:生图提示词|配图提示词|提示词)\*\*[：:]\s*([^\n]+)/);
      const italic = rest.match(/^\s*\*提示词[：:]([^\n]*?)\*(?=\s|$)/);
      const found = comment ?? inline ?? italic;
      if (!found) break;
      if (comment) for (const image of comment[1].matchAll(/!\[([^\]]*)\]\((\/article-assets\/[^)]+)\)/g)) embeddedImages.push({ markdown: image[0], url: image[2] });
      const prompt = found[1].replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
      if (prompt && !prompts.includes(prompt)) prompts.push(prompt);
      promptEnd += found[0].length;
    }
    slots.push({ alt: match[1], url: match[2], prompt: prompts.join("\n\n"), prompts, promptEnd, embeddedImages, start, end, source: body });
  }
  return slots;
}

export function stripArticlePromptText(body: string): string {
  let result = body;
  for (const slot of extractArticleSlots(body).reverse()) result = result.slice(0, slot.end) + result.slice(slot.promptEnd);
  return result;
}

export function recoverEmbeddedSlotImage(body: string, slot: ArticleSlot): string | null {
  if (body !== slot.source || slot.embeddedImages.length !== 1 || !/待替换|placeholder|upload.*填链接/i.test(slot.url)) return null;
  const image = slot.embeddedImages[0];
  const promptBlock = body.slice(slot.end, slot.promptEnd).replace(image.markdown, "");
  return body.slice(0, slot.start) + `![${slot.alt}](${image.url})` + promptBlock + body.slice(slot.promptEnd);
}

export function replaceArticleSlot(body: string, slot: ArticleSlot, url: string): string | null {
  if (body !== slot.source || !/^\/article-assets\//.test(url)) return null;
  return body.slice(0, slot.start) + `![${slot.alt}](${url})` + body.slice(slot.end);
}
