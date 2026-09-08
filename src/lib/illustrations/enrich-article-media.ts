import type { CoverImageVariant } from "@/lib/illustrations/cover";
import { buildCoverImagePlaceholder } from "@/lib/illustrations/cover";
import {
  buildIllustrationPlaceholder,
  insertAfterAnchor,
  type IllustrationSuggestion,
} from "@/lib/illustrations/insert";

const BODY_PLACEHOLDER_RE = /待替换-上传图片后填链接/g;
const COVER_PLACEHOLDER_RE = /待替换-上传封面图后填链接/;

export function countBodyIllustrationPlaceholders(body: string): number {
  return (body.match(BODY_PLACEHOLDER_RE) ?? []).length;
}

export function hasCoverPlaceholder(body: string): boolean {
  return COVER_PLACEHOLDER_RE.test(body);
}

/** 按锚点从后往前插入，减少前面插入导致后续锚点漂移 */
export function applyIllustrationSuggestionsToBody(
  body: string,
  suggestions: IllustrationSuggestion[]
): { body: string; inserted: number } {
  let next = body;
  let inserted = 0;

  const located = suggestions
    .map((suggestion) => {
      const anchor = suggestion.anchorSnippet.trim();
      const pos = anchor ? next.indexOf(anchor) : -1;
      return { suggestion, pos };
    })
    .filter((item) => item.pos >= 0)
    .sort((a, b) => b.pos - a.pos);

  for (const { suggestion } of located) {
    if (next.includes(`![${suggestion.altText}](`)) continue;
    const block = buildIllustrationPlaceholder(suggestion.altText, suggestion.gptPrompt);
    const result = insertAfterAnchor(next, suggestion.anchorSnippet, block);
    if (result.ok) {
      next = result.body;
      inserted += 1;
    }
  }

  for (const suggestion of suggestions) {
    if (next.includes(`![${suggestion.altText}](`)) continue;
    const block = buildIllustrationPlaceholder(suggestion.altText, suggestion.gptPrompt);
    const result = insertAfterAnchor(next, suggestion.anchorSnippet, block);
    if (result.ok) {
      next = result.body;
      inserted += 1;
    }
  }

  return { body: next, inserted };
}

export function prependCoverPlaceholder(
  body: string,
  variant: CoverImageVariant
): string {
  if (hasCoverPlaceholder(body)) return body;
  const block = buildCoverImagePlaceholder(variant.altText, variant.gptPrompt);
  return `${block}\n\n${body.trimStart()}`;
}

/** 去掉文首已有封面占位块（含 GPT 提示词注释） */
export function stripLeadingCoverPlaceholder(body: string): string {
  const trimmed = body.trimStart();
  const coverBlockRe =
    /^!\[[^\]]*\]\(待替换-上传封面图后填链接\)(?:\s*<!--\s*公众号封面 GPT 提示词[\s\S]*?-->)?\s*/;
  return trimmed.replace(coverBlockRe, "").trimStart();
}

/** 写入或替换正文最前面的封面提示词（只保留一套） */
export function upsertCoverPlaceholder(
  body: string,
  variant: CoverImageVariant
): string {
  const block = buildCoverImagePlaceholder(variant.altText, variant.gptPrompt);
  const rest = stripLeadingCoverPlaceholder(body);
  return rest ? `${block}\n\n${rest}` : block;
}

