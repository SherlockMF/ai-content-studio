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
      label: "标题已填写（粘贴到公众号标题栏）",
      ok: Boolean(input.title.trim()),
    },
    {
      id: "body",
      label: "正文非空",
      ok: Boolean(input.body.trim()),
    },
    {
      id: "digest",
      label: "摘要已填写（建议填写）",
      ok: Boolean(input.digest?.trim()),
      hint: input.digest?.trim() ? undefined : "列表页展示用，建议 40–120 字",
    },
    {
      id: "no-h1",
      label: "正文不含 H1（一级标题会降为加粗段落）",
      ok: !hasH1,
      hint: hasH1
        ? "正文 # 标题会按加粗段落导出，不占用公众号标题栏；建议改用 ##"
        : undefined,
    },
    {
      id: "images",
      label:
        placeholderCount > 0
          ? `无待替换占位图（当前 ${placeholderCount} 处）`
          : localImages > 0
            ? `本地图片 ${localImages} 张（复制时将内嵌）`
            : "图片：无本地图或均为外链",
      ok: placeholderCount === 0,
      hint:
        placeholderCount > 0
          ? "先用「插入本地图片」替换「待替换」占位"
          : undefined,
    },
    {
      id: "facts",
      label: factBlocked
        ? "事实 Diff 已人工确认"
        : input.factDiff
          ? input.factDiff.blocking
            ? "事实 Diff 已确认"
            : "事实核对通过"
          : "事实核对（润色后自动）",
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
