import type {
  ContentReview,
  XiaohongshuDraftData,
  XiaohongshuImagePrompt,
  XiaohongshuTone,
  XiaohongshuVariant,
} from "@/types/domain";
import {
  XIAOHONGSHU_BODY_MAX_CHARS,
  XIAOHONGSHU_TITLE_MAX_CHARS,
  countXiaohongshuChars,
} from "@/lib/xiaohongshu/limits";
import { extractHashtagsFromText } from "@/lib/xiaohongshu/note-body";
import { parseDataUrl } from "@/lib/export-assets";
import {
  detectOffPlatformDiversion,
  formatDiversionHint,
} from "@/lib/content-ops/topic-publish-revision";
import { XIAOHONGSHU_NO_PAGE_BADGES } from "@/lib/xiaohongshu/visual-rules";

export interface XiaohongshuPublishCheck {
  id: "title" | "body" | "hashtags" | "images" | "rendered-images" | "review" | "off-platform";
  label: string;
  ok: boolean;
  hint?: string;
  blocking: boolean;
}

const TONE_LABELS: Record<XiaohongshuTone, string> = {
  professional: "专业轻表达",
  social: "强氛围版",
};

const ROLE_LABELS: Record<XiaohongshuImagePrompt["role"], string> = {
  cover: "封面",
  content: "正文",
  ending: "收尾",
};

function isImagePlanComplete(imagePlan: XiaohongshuImagePrompt[]): boolean {
  if (imagePlan.length < 5 || imagePlan.length > 8) return false;

  return imagePlan.every((image, position) => {
    const expectedRole =
      position === 0 ? "cover" : position === imagePlan.length - 1 ? "ending" : "content";

    return (
      image.index === position + 1 &&
      image.role === expectedRole &&
      image.objective.trim().length > 0 &&
      image.overlayText.trim().length > 0 &&
      image.composition.trim().length > 0 &&
      image.prompt.trim().length > 0
    );
  });
}

export function buildXiaohongshuPublishChecks(input: {
  data: XiaohongshuDraftData;
  tone: XiaohongshuTone;
  review?: ContentReview;
}): XiaohongshuPublishCheck[] {
  const { data, tone, review } = input;
  const variant = data.variants[tone];
  const bodyTags = extractHashtagsFromText(variant.body);
  const hashtagsOk = bodyTags.length >= 5 && bodyTags.length <= 8;
  const reviewOk = !review?.issues.some((issue) => issue.severity === "high");
  const titleChars = countXiaohongshuChars(variant.title.trim());
  const bodyChars = countXiaohongshuChars(variant.body.trim());
  const titleOk = titleChars > 0 && titleChars <= XIAOHONGSHU_TITLE_MAX_CHARS;
  const bodyOk = bodyChars > 0 && bodyChars <= XIAOHONGSHU_BODY_MAX_CHARS;
  const diversionHits = detectOffPlatformDiversion(
    [variant.title, variant.body, ...data.imagePlan.map((image) => image.overlayText)].join("\n")
  );
  const diversionOk = diversionHits.length === 0;

  return [
    {
      id: "title",
      label: `标题完整（≤${XIAOHONGSHU_TITLE_MAX_CHARS} 字）`,
      ok: titleOk,
      hint: titleOk
        ? undefined
        : titleChars === 0
          ? "请填写当前版本标题"
          : `标题已超 ${XIAOHONGSHU_TITLE_MAX_CHARS} 字（当前 ${titleChars}）`,
      blocking: true,
    },
    {
      id: "body",
      label: `正文完整（≤${XIAOHONGSHU_BODY_MAX_CHARS} 字，含话题）`,
      ok: bodyOk,
      hint: bodyOk
        ? undefined
        : bodyChars === 0
          ? "请填写当前版本正文"
          : `正文已超 ${XIAOHONGSHU_BODY_MAX_CHARS} 字（当前 ${bodyChars}）`,
      blocking: true,
    },
    {
      id: "off-platform",
      label: diversionOk ? "无站外引流信息" : "存在站外引流风险",
      ok: diversionOk,
      hint: formatDiversionHint(diversionHits),
      blocking: true,
    },
    {
      id: "hashtags",
      label: "正文含 5～8 个 #话题",
      ok: hashtagsOk,
      hint: hashtagsOk
        ? undefined
        : `正文末尾需要带 # 的话题（当前 ${bodyTags.length} 个）`,
      blocking: true,
    },
    {
      id: "images",
      label: "图片规划完整",
      ok: isImagePlanComplete(data.imagePlan),
      hint: isImagePlanComplete(data.imagePlan)
        ? undefined
        : "需要 5～8 张连续图片，以封面开始、收尾结束，并补全每张提示词",
      blocking: true,
    },
    {
      id: "rendered-images",
      label: "配图已生成",
      ok: data.imagePlan.length > 0 && data.imagePlan.every((image) => Boolean(image.imageUrl)),
      hint: data.imagePlan.every((image) => Boolean(image.imageUrl))
        ? undefined
        : "还有配图未生成，可点「生成配图」补全",
      blocking: false,
    },
    {
      id: "review",
      label: "质检无必须修改项",
      ok: reviewOk,
      hint: reviewOk ? undefined : "最近一次质检仍有必须修改的问题",
      blocking: !reviewOk,
    },
  ];
}

/** 粘贴到小红书正文区：只复制正文（已含 #话题） */
export function buildXiaohongshuBodyCopyText(variant: XiaohongshuVariant): string {
  return variant.body.trim();
}

/** 完整笔记：标题 + 正文（正文已含收尾与 #话题） */
export function buildXiaohongshuNoteText(variant: XiaohongshuVariant): string {
  return [variant.title.trim(), variant.body.trim()].filter(Boolean).join("\n\n");
}

function buildPromptBlock(image: XiaohongshuImagePrompt): string {
  return [
    `图 ${image.index} · ${ROLE_LABELS[image.role]}`,
    `画面职责：${image.objective.trim()}`,
    `图中文字：${image.overlayText.trim()}`,
    `构图：${image.composition.trim()}`,
    `完整提示词：${image.prompt.trim()}`,
    XIAOHONGSHU_NO_PAGE_BADGES,
  ].join("\n");
}

export function buildXiaohongshuPromptText(
  data: Pick<XiaohongshuDraftData, "visualDirection" | "imagePlan">
): string {
  return [
    `视觉方向：${data.visualDirection.trim()}`,
    ...data.imagePlan.map(buildPromptBlock),
  ].join("\n\n");
}

export function buildXiaohongshuPublishMarkdown(
  data: XiaohongshuDraftData,
  tone: XiaohongshuTone,
  sourceTitle?: string
): string {
  const backupTone: XiaohongshuTone = tone === "professional" ? "social" : "professional";
  const imageSections = data.imagePlan.map((image) =>
    [
      `### 图 ${image.index} · ${ROLE_LABELS[image.role]}`,
      "",
      `- 画面职责：${image.objective.trim()}`,
      `- 图中文字：${image.overlayText.trim()}`,
      `- 构图：${image.composition.trim()}`,
      image.imageUrl ? `- 配图：${image.imageUrl}` : "- 配图：未生成",
      `- 完整提示词：${image.prompt.trim()}`,
      `- ${XIAOHONGSHU_NO_PAGE_BADGES}`,
    ].join("\n")
  );

  return [
    "# 小红书发布包",
    "",
    `- 来源稿件：${sourceTitle?.trim() || "来源稿件不可用"}`,
    `- 当前风格：${TONE_LABELS[tone]}`,
    "",
    `## 当前发布版本：${TONE_LABELS[tone]}`,
    "",
    buildXiaohongshuNoteText(data.variants[tone]),
    "",
    `## 备选版本：${TONE_LABELS[backupTone]}`,
    "",
    buildXiaohongshuNoteText(data.variants[backupTone]),
    "",
    "## 图片规划",
    "",
    `**视觉方向：** ${data.visualDirection.trim()}`,
    "",
    ...imageSections.flatMap((section) => [section, ""]),
  ]
    .join("\n")
    .trimEnd();
}

/** 发布包必须含全部原图，不能把下载失败的图片悄悄替换成链接。 */
export async function buildXiaohongshuPublishBundle(
  data: XiaohongshuDraftData,
  tone: XiaohongshuTone,
  sourceTitle?: string
) {
  const imagePlan = [...data.imagePlan].sort((a, b) => a.index - b.index);
  if (!isImagePlanComplete(imagePlan)) throw new Error("图片规划不完整，请先完成图片规划");
  for (const image of imagePlan) {
    if (!image.imageUrl?.trim()) throw new Error(`图 ${image.index} 未生成，请先补全配图`);
  }

  const images = await Promise.all(imagePlan.map(async (image) => {
    try {
      const url = image.imageUrl!.trim();
      let bytes: Uint8Array;
      let mime: string;
      if (url.startsWith("data:")) {
        const parsed = parseDataUrl(url);
        if (!parsed) throw new Error("图片数据无效");
        bytes = parsed.bytes;
        mime = parsed.mime;
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[mime];
      if (!ext || bytes.length === 0) throw new Error("未读取到有效图片文件");
      return { image, bytes, path: `images/${String(image.index).padStart(2, "0")}-${image.role}.${ext}` };
    } catch (error) {
      throw new Error(`图 ${image.index} 导出失败：${error instanceof Error ? error.message : "无法读取图片"}`);
    }
  }));

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const image of images) zip.file(image.path, image.bytes);
  const addCopy = (prefix: string, variant: XiaohongshuVariant) => {
    zip.file(`${prefix}标题.txt`, variant.title.trim());
    zip.file(`${prefix}正文.txt`, buildXiaohongshuBodyCopyText(variant));
    zip.file(`${prefix}标签.txt`, extractHashtagsFromText(variant.body).map((tag) => `#${tag}`).join(" "));
    zip.file(`${prefix}完整笔记.txt`, buildXiaohongshuNoteText(variant));
  };
  addCopy("", data.variants[tone]);
  addCopy("备选文案/", data.variants[tone === "professional" ? "social" : "professional"]);
  zip.file("发布说明.md", buildXiaohongshuPublishMarkdown({
    ...data,
    imagePlan: images.map(({ image, path }) => ({ ...image, imageUrl: `./${path}` })),
  }, tone, sourceTitle));
  const baseName = data.variants[tone].title.trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-").slice(0, 80).replace(/[. ]+$/g, "") || "xiaohongshu";
  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: `${baseName}-xiaohongshu.zip`,
  };
}
