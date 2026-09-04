import type { XiaohongshuVariant } from "@/types/domain";
import {
  clampXiaohongshuBody,
  clampXiaohongshuTitle,
} from "@/lib/xiaohongshu/limits";

export function normalizeHashtagLabel(hashtag: string): string {
  return hashtag.trim().replace(/^#+/, "").trim();
}

export function formatHashtagLine(hashtags: string[]): string {
  return hashtags
    .map(normalizeHashtagLabel)
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");
}

/** 从正文中提取带 # 的话题（去重，不含 #） */
export function extractHashtagsFromText(text: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(/#([^\s#]+)/g)) {
    const tag = normalizeHashtagLabel(match[1] ?? "");
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/**
 * 把互动收尾与话题并入正文，话题统一写成 #标签。
 * 编辑区只保留 title + body；cta/hashtags 仅作兼容字段。
 */
export function foldXiaohongshuVariant(variant: XiaohongshuVariant): XiaohongshuVariant {
  let body = variant.body.trim();
  const cta = variant.cta.trim();
  if (cta && !body.includes(cta)) {
    body = `${body}\n\n${cta}`;
  }

  let hashtags = extractHashtagsFromText(body);
  if (hashtags.length < 5) {
    const fromField = variant.hashtags.map(normalizeHashtagLabel).filter(Boolean);
    const merged = [...hashtags];
    for (const tag of fromField) {
      if (!merged.includes(tag)) merged.push(tag);
    }
    if (merged.length > hashtags.length) {
      const line = formatHashtagLine(merged);
      if (line) {
        // 去掉文末已有的零散 #标签行，再统一追加
        body = body.replace(/(?:\n|^)\s*(?:#[^\s#]+(?:\s+#[^\s#]+)*)\s*$/u, "").trimEnd();
        body = `${body}\n\n${line}`;
      }
    }
  }

  body = clampXiaohongshuBody(body);
  hashtags = extractHashtagsFromText(body);

  return {
    title: clampXiaohongshuTitle(variant.title.trim()),
    body,
    cta: "",
    hashtags,
  };
}

export function foldXiaohongshuVariants(
  variants: Record<"professional" | "social", XiaohongshuVariant>
): Record<"professional" | "social", XiaohongshuVariant> {
  return {
    professional: foldXiaohongshuVariant(variants.professional),
    social: foldXiaohongshuVariant(variants.social),
  };
}
