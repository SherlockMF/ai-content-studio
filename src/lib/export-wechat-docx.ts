import { buildWechatDocxBlob, renderWechatDocxFromMarkdown } from "@/lib/markdown/wechat-docx";

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
