/** 从上传文件提取纯文本（供补充信息 / AI 改稿） */

import { extractDocumentText } from "@/lib/api-client/files";

const MAX_EXTRACT_CHARS = 24_000;
export const MAX_KNOWLEDGE_FILE_BYTES = 10 * 1024 * 1024;

export const SUPPLEMENTARY_DOC_ACCEPT =
  ".docx,.md,.markdown,.txt,.pdf";
export const KNOWLEDGE_DOC_ACCEPT = SUPPLEMENTARY_DOC_ACCEPT;

export function truncateExtractedText(text: string, maxChars = MAX_EXTRACT_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n…（文档过长，已截断至 ${maxChars} 字）`;
}

export function appendSupplementaryDocument(
  existingNotes: string,
  fileName: string,
  extracted: string
) {
  const block = [
    `--- 上传文档：${fileName} ---`,
    truncateExtractedText(extracted),
  ].join("\n");
  const base = existingNotes.trim();
  return base ? `${base}\n\n${block}` : block;
}

/** 浏览器端：txt / md 直接读；docx / pdf 走 API。 */
export async function extractTextFromUpload(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
    return file.text();
  }
  if (name.endsWith(".docx") || name.endsWith(".pdf")) {
    return extractDocumentText(file, "supplementary");
  }
  throw new Error("暂不支持该格式，请上传 .docx / .pdf / .md / .txt");
}

export async function extractKnowledgeFile(file: File): Promise<string> {
  if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
    throw new Error("文件超过 10 MB，请压缩或拆分后上传");
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) {
    throw new Error("暂不支持旧版 .doc，请转换为 .docx 后上传");
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
    return file.text();
  }
  if (name.endsWith(".docx") || name.endsWith(".pdf")) {
    return extractDocumentText(file, "knowledge");
  }
  throw new Error("暂不支持该格式，请上传 .docx / .pdf / .md / .txt");
}
