import { z } from "zod";
import { insertAfterAnchor } from "./insert";

export const wechatMediaImageSchema = z.object({
  sourceIndex: z.number().int().nonnegative().nullable(),
  action: z.enum(["keep", "generate"]),
  purpose: z.enum(["cover", "illustration"]),
  altText: z.string().trim().min(1),
  anchorSnippet: z.string(),
  prompt: z.string().trim().min(1),
});
export const wechatMediaPlanSchema = z.object({ images: z.array(wechatMediaImageSchema).min(4).max(12) });
type ExistingImage = { url: string; altText: string; prompt: string; purpose: "cover" | "illustration"; context: string };
export type WechatMediaImage = z.infer<typeof wechatMediaImageSchema> & { sourceUrl?: string };
export type WechatMediaPlan = { body: string; images: WechatMediaImage[] };

export function extractWechatImages(body: string) {
  const images: ExistingImage[] = [];
  const clean = body.replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\s*<!--\s*(公众号封面 GPT 提示词[^\n]*|GPT 配图提示词[^\n]*)\n([\s\S]*?)-->|\s*\*提示词[：:]([^\n]*)\*)?/g,
    (block: string, altText: string, url: string, header: string | undefined, prompt: string | undefined, inlinePrompt: string | undefined, offset: number) => {
      images.push({ url, altText, prompt: (prompt ?? inlinePrompt ?? "").trim(),
        purpose: /封面/.test(`${altText} ${header ?? ""} ${url}`) ? "cover" : "illustration",
        context: body.slice(Math.max(0, offset - 180), offset) + body.slice(offset + block.length, offset + block.length + 180),
      });
      return "";
    });
  return { body: clean.trim(), images };
}

export function validateWechatMediaPlan(images: WechatMediaImage[], existing: ExistingImage[], body: string): WechatMediaPlan {
  wechatMediaPlanSchema.parse({ images });
  if (images.filter((i) => i.purpose === "cover").length !== 1) throw new Error("配图方案必须包含一张封面");
  const seen = new Set<number>();
  const validated = images.map((image) => {
    const old = image.sourceIndex === null ? undefined : existing[image.sourceIndex];
    if (image.sourceIndex !== null) {
      if (!old || seen.has(image.sourceIndex)) throw new Error("配图来源索引无效或重复");
      seen.add(image.sourceIndex);
    }
    if (image.action === "keep" && (!old || /待替换|placeholder/i.test(old.url))) {
      throw new Error("不能保留尚未生成的图片");
    }
    if (image.action === "keep" && old?.purpose !== image.purpose) {
      throw new Error("保留图片的用途不能改变");
    }
    if (image.purpose !== "cover" && (!image.anchorSnippet.trim() || !body.includes(image.anchorSnippet))) {
      throw new Error("配图位置无法对应正文，请重试配图检查");
    }
    return { ...image, prompt: image.action === "keep" && old?.prompt ? old.prompt : image.prompt, sourceUrl: old?.url };
  });
  if (existing.some((image, index) => !/待替换|placeholder/i.test(image.url) && !seen.has(index))) {
    throw new Error("配图方案遗漏已有图片，请重试配图检查");
  }
  return { body, images: validated };
}

export async function renderWechatMedia(plan: WechatMediaPlan, options: {
  generate: (input: { prompt: string; purpose: "cover" | "illustration" }) => Promise<{ url: string }>;
  onUpdate: (body: string) => void;
  onProgress?: (message: string) => void;
}) {
  let body = plan.body;
  const slots = plan.images.map((image, index) => ({
    ...image, placeholder: `待替换-公众号配图-${index + 1}`,
  }));
  // 倒序插入，保证同一锚点下图片仍保持方案顺序。
  for (const image of [...slots].reverse()) {
    const url = image.action === "keep" ? image.sourceUrl : image.placeholder;
    if (!url) throw new Error("缺少待保留图片的地址");
    const alt = image.purpose === "cover" ? "公众号封面" : image.altText.replace(/[\[\]]/g, "");
    const header = image.purpose === "cover" ? "公众号封面 GPT 提示词" : "GPT 配图提示词";
    const block = `![${alt}](${url})\n\n<!-- ${header}\n${image.prompt.replace(/-->/g, "")}\n-->`;
    if (image.purpose === "cover") body = `${block}\n\n${body}`;
    else {
      const inserted = insertAfterAnchor(body, image.anchorSnippet, block);
      if (!inserted.ok) throw new Error("无法插入配图，正文已变化");
      body = inserted.body;
    }
  }
  options.onUpdate(body);
  const failures: string[] = [];
  for (const [index, image] of slots.entries()) {
    if (image.action === "keep") continue;
    options.onProgress?.(`生成配图 ${index + 1}/${slots.length}…`);
    let url: string;
    try {
      ({ url } = await options.generate({ prompt: image.prompt, purpose: image.purpose }));
    } catch (error) {
      failures.push(`图 ${index + 1}：${error instanceof Error ? error.message : "生成失败"}`);
      continue;
    }
    body = body.replace(`](${image.placeholder})`, `](${url})`);
    options.onUpdate(body);
  }
  return { body, failures };
}
