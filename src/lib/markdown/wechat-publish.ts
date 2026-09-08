import { PLACEHOLDER_RE, IMAGE_MD_RE } from "@/lib/export-assets";
import { bodyContainsH1 } from "@/lib/markdown/parse";
import {
  renderWechatHtml,
  wrapClipboardHtml,
} from "@/lib/markdown/wechat-html";
import { WechatThemeId } from "@/lib/markdown/wechat-theme";
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

  if (typeof input.reviewScore === "number") {
    checks.push({
      id: "review",
      label: `AI 质检 ${input.reviewScore} 分`,
      ok: input.reviewScore >= 75,
      hint: input.reviewScore >= 75 ? undefined : "建议润色或修正后再发",
    });
  }

  return checks;
}

export async function buildWechatPublishHtml(input: {
  body: string;
  theme?: WechatThemeId;
  embedImages?: boolean;
  origin?: string;
}) {
  return renderWechatHtml(input.body, {
    theme: input.theme ?? "tech-eval",
    embedImages: input.embedImages ?? true,
    stripH1: true,
    origin: input.origin ?? (typeof window !== "undefined" ? window.location.origin : ""),
  });
}

export async function copyWechatRichText(input: {
  body: string;
  title: string;
  digest?: string;
  theme?: WechatThemeId;
}) {
  const fragment = await buildWechatPublishHtml({
    body: input.body,
    theme: input.theme,
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
