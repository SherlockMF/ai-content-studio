import { buildWechatDocxBlob, renderWechatDocxFromMarkdown } from "@/lib/markdown/wechat-docx";
import JSZip from "jszip";
import { IMAGE_MD_RE, detectImageType, resolveMarkdownImage } from "@/lib/export-assets";
import { stripArticlePromptText } from "@/lib/illustrations/article-slots";

export function buildWechatPublishClipboard(input: { title: string; digest?: string }) {
  const lines = [`标题：${input.title.trim()}`];
  if (input.digest?.trim()) lines.push(`摘要：${input.digest.trim()}`);
  lines.push("", "正文请导入同目录下的 Word 文件，或使用工作台「复制公众号富文本」。");
  return lines.join("\n");
}

/** 导出公众号可导入的 Word（基于 remark AST，与 HTML 预览同源） */
export async function buildWechatDocxBundle(input: {
  title: string;
  digest?: string;
  body: string;
  fileBaseName?: string;
}) {
  const children = await renderWechatDocxFromMarkdown(input.body.trim(), { stripH1: true });
  const blob = await buildWechatDocxBlob(children);
  const base =
    input.fileBaseName?.trim() ||
    input.title.trim().slice(0, 36).replace(/[\\/:*?"<>|]/g, "_") ||
    "wechat-article";

  return {
    blob,
    fileName: `${base}-公众号正文.docx`,
    clipboardText: buildWechatPublishClipboard(input),
  };
}

/** 发布包：带图 Word 与同一批原图一起导出，缺图时不生成残缺包。 */
export async function buildWechatPublishBundle(input: {
  title: string;
  digest?: string;
  body: string;
}) {
  const zip = new JSZip();
  let body = stripArticlePromptText(input.body).replace(/<!--[\s\S]*?-->/g, "");
  const entries = [...body.matchAll(IMAGE_MD_RE)];
  let imageCount = 0;
  for (const match of entries) {
    const resolved = await resolveMarkdownImage(match[2]);
    if (!resolved) throw new Error(`配图「${match[1] || imageCount + 1}」尚未生成或无法读取，请补齐图片后导出`);
    imageCount += 1;
    const ext = detectImageType(resolved.bytes);
    const label = match[1].trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 40) || "配图";
    zip.file(`images/${String(imageCount).padStart(2, "0")}-${label}.${ext}`, resolved.bytes);
    // Word 复用已读取的图片，避免二次请求得到不同结果或中途失败。
    const encoded = Array.from(resolved.bytes, (byte) => String.fromCharCode(byte)).join("");
    const mime = ext === "jpg" ? "jpeg" : ext;
    body = body.replace(match[0], `![${match[1]}](data:image/${mime};base64,${btoa(encoded)})`);
  }
  const docx = await buildWechatDocxBundle({ ...input, body });
  zip.file(docx.fileName, await docx.blob.arrayBuffer());
  zip.file("标题和摘要.txt", buildWechatPublishClipboard(input));
  const base = input.title.trim().slice(0, 36).replace(/[\\/:*?"<>|]/g, "_") || "wechat-article";
  return { blob: await zip.generateAsync({ type: "blob" }), fileName: `${base}-公众号发布包.zip`, imageCount };
}
