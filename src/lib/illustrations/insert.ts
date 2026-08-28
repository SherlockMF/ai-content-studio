import { z } from "zod";
import { illustrationSuggestionSchema } from "@/lib/ai/schemas";

export type IllustrationKind =
  | "数据图表"
  | "流程示意图"
  | "概念插图"
  | "对比图"
  | "架构图";

export interface IllustrationSuggestion {
  id: string;
  placementLabel: string;
  anchorSnippet: string;
  reason: string;
  imageKind: IllustrationKind;
  gptPrompt: string;
  altText: string;
}

/** @deprecated use IllustrationSuggestion */
export type IllustrationSuggestionInput = z.infer<typeof illustrationSuggestionSchema>;

export function buildIllustrationPlaceholder(altText: string, gptPrompt: string) {
  return [
    `![${altText}](待替换-上传图片后填链接)`,
    "",
    "<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）",
    gptPrompt,
    "-->",
  ].join("\n");
}

/** 在 anchorSnippet 之后插入配图占位块 */
export function insertAfterAnchor(body: string, anchorSnippet: string, block: string) {
  const anchor = anchorSnippet.trim();
  if (!anchor) return { body, ok: false as const };

  const tryInsert = (snippet: string) => {
    const idx = body.indexOf(snippet);
    if (idx === -1) return null;
    const at = idx + snippet.length;
    return `${body.slice(0, at)}\n\n${block}\n\n${body.slice(at)}`;
  };

  const direct = tryInsert(anchor);
  if (direct) return { body: direct, ok: true as const };

  const plain = anchor.replace(/\*\*/g, "");
  const plainBody = body.replace(/\*\*/g, "");
  const plainIdx = plainBody.indexOf(plain);
  if (plainIdx !== -1) {
    const at = plainIdx + plain.length;
    return {
      body: `${body.slice(0, at)}\n\n${block}\n\n${body.slice(at)}`,
      ok: true as const,
    };
  }

  const shortAnchor = anchor.slice(0, 40).trim();
  const fuzzyIdx = shortAnchor.length >= 12 ? body.indexOf(shortAnchor) : -1;
  if (fuzzyIdx !== -1) {
    const at = fuzzyIdx + shortAnchor.length;
    return { body: `${body.slice(0, at)}\n\n${block}\n\n${body.slice(at)}`, ok: true as const };
  }

  return { body, ok: false as const };
}
