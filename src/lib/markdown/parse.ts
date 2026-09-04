import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { Root } from "mdast";

const processor = unified().use(remarkParse).use(remarkGfm);

/** 将 Markdown 解析为 MDAST（GFM：表格、删除线等） */
export function parseMarkdownToAst(markdown: string): Root {
  return processor.parse(markdown) as Root;
}

/** 正文是否含一级标题（公众号标题栏单独填，正文不应重复 H1） */
export function bodyContainsH1(markdown: string) {
  const ast = parseMarkdownToAst(markdown);
  return ast.children.some((node) => node.type === "heading" && node.depth === 1);
}
