import { PLACEHOLDER_RE, IMAGE_MD_RE } from "@/lib/export-assets";
import { bodyContainsH1 } from "@/lib/markdown/parse";
import { collectWechatEditorialFlags } from "@/lib/markdown/wechat-editorial-flags";
import {
  renderWechatHtml,
  wrapClipboardHtml,
  escapeHtml,
} from "@/lib/markdown/wechat-html";
import type { WechatLayoutSettings } from "@/lib/markdown/wechat-theme";
import { validateWechatHtml } from "@/lib/markdown/wechat-html-validation";
import { stripArticlePromptText } from "@/lib/illustrations/article-slots";
import { buildWechatPublishClipboard } from "@/lib/export-wechat-docx";
import { FactDiffReport } from "@/lib/fact-diff";

export interface PublishCheckItem {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
}

export function buildWechatPublishChecks(input: {
  title: string;
  digest?: string;
  body: string;
  reviewScore?: number;
  xiaohongshuImageUrls?: string[];
  factDiff?: FactDiffReport | null;
  factDiffAcknowledged?: boolean;
}) {
  const placeholderCount = [...input.body.matchAll(IMAGE_MD_RE)].filter((m) =>
    PLACEHOLDER_RE.test(m[2]?.trim() ?? "")
  ).length;
  const localImages = [...input.body.matchAll(IMAGE_MD_RE)].filter((m) => {
    const url = m[2]?.trim() ?? "";
    return url.startsWith("/article-assets/") || url.startsWith("data:image");
  }).length;
  const hasH1 = bodyContainsH1(input.body);
  const xiaohongshuUrls = new Set(input.xiaohongshuImageUrls ?? []);
  const mixedImagePositions = [...input.body.matchAll(IMAGE_MD_RE)]
    .flatMap((match, index) => xiaohongshuUrls.has(match[2].trim()) ? [index + 1] : []);
  const factBlocked = Boolean(
    input.factDiff?.blocking && !input.factDiffAcknowledged
  );

  const checks: PublishCheckItem[] = [
    {
      id: "title",
      label: "标题已填写",
      ok: Boolean(input.title.trim()),
    },
    {
      id: "body",
      label: "正文非空",
      ok: Boolean(input.body.trim()),
    },
    {
      id: "digest",
      label: "摘要已填写",
      ok: Boolean(input.digest?.trim()),
      hint: input.digest?.trim() ? undefined : "列表页展示用，建议填写",
    },
    {
      id: "no-h1",
      label: "正文不含一级标题 #",
      ok: !hasH1,
      hint: hasH1 ? "建议把 # 改成 ##，避免和公众号标题栏冲突" : undefined,
    },
    {
      id: "images",
      label:
        placeholderCount > 0
          ? `仍有 ${placeholderCount} 处待替换配图`
          : localImages > 0
            ? `本地图片 ${localImages} 张`
            : "无待替换配图",
      ok: placeholderCount === 0,
      hint:
        placeholderCount > 0
          ? "用「插入本地图片」替换后，才能复制富文本到公众号"
          : undefined,
    },
    {
      id: "image-platform",
      label: mixedImagePositions.length ? "配图混用了小红书图片" : "未混用小红书配图",
      ok: mixedImagePositions.length === 0,
      hint: mixedImagePositions.length
        ? `第 ${mixedImagePositions.join("、")} 张引用了小红书配图，请替换为公众号专用图片后再复制或导出`
        : undefined,
    },
    {
      id: "facts",
      label: factBlocked
        ? "事实 Diff 待确认"
        : input.factDiff
          ? "事实核对通过"
          : "事实核对",
      ok: !factBlocked,
      hint: factBlocked
        ? input.factDiff?.summary ?? "存在关键数值变化，需确认后才能发布"
        : undefined,
    },
  ];

  const editorialFlags = collectWechatEditorialFlags(input.body);
  for (const flag of editorialFlags) {
    if (flag.id === "orphan-source-link") {
      checks.push({
        id: flag.id,
        label: "无悬空「来源」引用",
        ok: false,
        hint: flag.suggestion,
      });
      continue;
    }
    if (flag.id === "broken-markdown-table") {
      checks.push({
        id: flag.id,
        label: "Markdown 表格可解析",
        ok: false,
        hint: flag.suggestion,
      });
      continue;
    }
    if (flag.id === "table-preview-reminder") {
      checks.push({
        id: flag.id,
        label: "含表格：请核对接预览",
        ok: true,
        hint: flag.suggestion,
      });
    }
  }

  if (typeof input.reviewScore === "number") {
    checks.push({
      id: "review",
      label: `AI 质检 ${input.reviewScore} 分`,
      ok: input.reviewScore >= 75,
      hint: input.reviewScore >= 75 ? undefined : "建议润色或修正后再发",
    });
  }

  checks.push({
    id: "sticker-reminder",
    label: "贴图一文双发（可选）",
    ok: true,
    hint: "若用官方「文章生成贴图」：发布前改大字痛点封面，再发贴图；贴图优先推非粉，不是误发",
  });

  return checks;
}

type PublishHtmlInput = Partial<WechatLayoutSettings> & {
  body: string;
  embedImages?: boolean;
  origin?: string;
};

export async function buildWechatPublishHtml(input: PublishHtmlInput) {
  const html = await renderWechatHtml(stripArticlePromptText(input.body), {
    theme: input.theme ?? "tech-eval",
    numberSections: input.numberSections,
    emphasize: input.emphasize,
    embedImages: input.embedImages ?? true,
    stripH1: true,
    origin: input.origin ?? (typeof window !== "undefined" ? window.location.origin : ""),
  });
  const result = validateWechatHtml(html);
  if (result.errors.length) throw new Error(`排版检查未通过：${result.errors.join("；")}`);
  return html;
}

export async function buildWechatHtmlDocument(input: Partial<WechatLayoutSettings> & { body: string; title: string }) {
  const fragment = await buildWechatPublishHtml({ ...input, embedImages: true });
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(input.title)}</title></head><body style="margin: 0 auto; max-width: 677px; background: #ffffff;">${fragment}</body></html>`;
}

export async function copyWechatRichText(input: Partial<WechatLayoutSettings> & {
  body: string;
  title: string;
  digest?: string;
}) {
  const fragment = await buildWechatPublishHtml({
    body: input.body,
    theme: input.theme,
    numberSections: input.numberSections,
    emphasize: input.emphasize,
    embedImages: true,
  });
  const html = wrapClipboardHtml(fragment);
  const plain = buildWechatPublishClipboard({ title: input.title, digest: input.digest });

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }

  // fallback
  await navigator.clipboard.writeText(plain);
  throw new Error("当前浏览器不支持复制富文本，已仅复制标题/摘要说明");
}
