import type { Root, RootContent } from "mdast";
import { parseMarkdownToAst } from "@/lib/markdown/parse";

export type EditorialFlagSeverity = "low" | "medium" | "high";

export interface EditorialFlag {
  id: "orphan-source-link" | "broken-markdown-table" | "table-preview-reminder";
  dimension: string;
  severity: EditorialFlagSeverity;
  suggestion: string;
}

export interface ReviewIssueLike {
  dimension: string;
  severity: EditorialFlagSeverity;
  suggestion: string;
}

const ORPHAN_SOURCE_LINE_RE = /^\s*\[来源\]\([^)]+\)\s*$/;
/** 表格分隔行特征，如 | --- | --- | 或压缩后的 | --- | --- | */
const TABLE_SEP_RE = /\|[\t ]*:?-{3,}:?[\t ]*(\|[\t ]*:?-{3,}:?[\t ]*)+\|/;

function walkNodes(nodes: RootContent[], visit: (node: RootContent) => void) {
  for (const node of nodes) {
    visit(node);
    if ("children" in node && Array.isArray(node.children)) {
      walkNodes(node.children as RootContent[], visit);
    }
  }
}

function countTables(ast: Root) {
  let count = 0;
  walkNodes(ast.children, (node) => {
    if (node.type === "table") count += 1;
  });
  return count;
}

function hasOrphanSourceLink(body: string) {
  return body.split(/\r?\n/).some((line) => ORPHAN_SOURCE_LINE_RE.test(line));
}

export function collectWechatEditorialFlags(body: string): EditorialFlag[] {
  const flags: EditorialFlag[] = [];
  const ast = parseMarkdownToAst(body);
  const tableCount = countTables(ast);
  const looksLikeTableMarkup = TABLE_SEP_RE.test(body);

  if (hasOrphanSourceLink(body)) {
    flags.push({
      id: "orphan-source-link",
      dimension: "orphan-source-link",
      severity: "high",
      suggestion:
        "存在独占一行的「[来源](url)」引用。请删掉悬空「来源」，或改成写入句子的可读出处，避免插图后只剩两个字。",
    });
  }

  if (looksLikeTableMarkup && tableCount === 0) {
    flags.push({
      id: "broken-markdown-table",
      dimension: "broken-markdown-table",
      severity: "high",
      suggestion:
        "正文含表格分隔符但未能解析为 Markdown 表（常见于换行被压扁）。请恢复每行一条的标准表格，否则预览会露出 | --- | 源码。",
    });
  }

  if (tableCount > 0) {
    flags.push({
      id: "table-preview-reminder",
      dimension: "table-preview-reminder",
      severity: "medium",
      suggestion:
        "正文含 Markdown 表格。复制到公众号或预览时请核对是否渲染成表，勿露出 | 源码。",
    });
  }

  return flags;
}

export function mergeEditorialFlagsIntoReview<
  T extends { score: number; issues: ReviewIssueLike[] },
>(review: T, flags: EditorialFlag[]): T {
  const existing = new Set(review.issues.map((issue) => issue.dimension));
  const extras = flags
    .filter((flag) => !existing.has(flag.dimension))
    .map(({ dimension, severity, suggestion }) => ({
      dimension,
      severity,
      suggestion,
    }));
  if (!extras.length) return review;
  return { ...review, issues: [...review.issues, ...extras] };
}
