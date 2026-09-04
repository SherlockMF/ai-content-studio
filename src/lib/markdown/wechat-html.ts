import type {
  BlockContent,
  Content,
  Definition,
  ListItem,
  PhrasingContent,
  Root,
  Table,
  TableCell,
} from "mdast";
import { detectImageType, resolveMarkdownImage } from "@/lib/export-assets";
import { parseMarkdownToAst } from "@/lib/markdown/parse";
import { getWechatTheme, WechatTheme, WechatThemeId } from "@/lib/markdown/wechat-theme";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bytesToDataUrl(bytes: Uint8Array) {
  const type = detectImageType(bytes);
  const mime = type === "jpg" ? "image/jpeg" : type === "gif" ? "image/gif" : "image/png";
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

async function defaultImageResolver(url: string, embed: boolean, origin?: string) {
  if (embed) {
    const resolved = await resolveMarkdownImage(url);
    if (!resolved) return null;
    return bytesToDataUrl(resolved.bytes);
  }
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("/") && origin) return `${origin}${url}`;
  return url;
}

export interface RenderWechatHtmlOptions {
  theme?: WechatThemeId;
  /** 内嵌图片为 base64（复制到微信剪贴板时必须） */
  embedImages?: boolean;
  /** 跳过正文 H1，避免与公众号标题栏重复 */
  stripH1?: boolean;
  origin?: string;
  imageResolver?: (url: string, alt: string) => Promise<string | null>;
}

async function renderPhrasing(
  nodes: PhrasingContent[],
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderWechatHtmlOptions
): Promise<string> {
  const parts: string[] = [];
  for (const node of nodes) {
    parts.push(await renderPhrasingNode(node, theme, defs, options));
  }
  return parts.join("");
}

async function renderPhrasingNode(
  node: PhrasingContent,
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderWechatHtmlOptions
): Promise<string> {
  switch (node.type) {
    case "text":
      return escapeHtml(node.value);
    case "strong": {
      const inner = await renderPhrasing(node.children, theme, defs, options);
      // 微信粘贴常剥掉 strong 的 font-weight，内层 span 双保险
      return `<strong style="${theme.strong}"><span style="${theme.strong}">${inner}</span></strong>`;
    }
    case "emphasis":
      return `<em style="${theme.em}">${await renderPhrasing(node.children, theme, defs, options)}</em>`;
    case "delete":
      return `<span style="text-decoration: line-through;">${await renderPhrasing(node.children, theme, defs, options)}</span>`;
    case "inlineCode":
      return `<code style="${theme.inlineCode}">${escapeHtml(node.value)}</code>`;
    case "link": {
      const inner = await renderPhrasing(node.children, theme, defs, options);
      return `<a style="${theme.a}" href="${escapeHtml(node.url)}">${inner}</a>`;
    }
    case "linkReference": {
      const def = defs.get(node.identifier.toUpperCase());
      if (!def) return await renderPhrasing(node.children, theme, defs, options);
      const inner = await renderPhrasing(node.children, theme, defs, options);
      return `<a style="${theme.a}" href="${escapeHtml(def.url)}">${inner}</a>`;
    }
    case "break":
      return "<br />";
    case "image": {
      const resolver =
        options.imageResolver ??
        ((url) =>
          defaultImageResolver(url, Boolean(options.embedImages), options.origin));
      const src = await resolver(node.url, node.alt ?? "");
      if (!src) {
        return `<p style="${theme.p}">[图片：${escapeHtml(node.alt || "未就绪")}]</p>`;
      }
      return `<img style="${theme.img}" src="${escapeHtml(src)}" alt="${escapeHtml(node.alt ?? "")}" />`;
    }
    case "html":
      if (node.value.trim().startsWith("<!--")) return "";
      return node.value;
    default:
      return "";
  }
}

async function renderListItem(
  node: ListItem,
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderWechatHtmlOptions
) {
  const inner: string[] = [];
  for (const child of node.children) {
    if (child.type === "paragraph") {
      inner.push(await renderPhrasing(child.children, theme, defs, options));
      continue;
    }
    if (child.type === "list") {
      const tag = child.ordered ? "ol" : "ul";
      const style = child.ordered ? theme.ol : theme.ul;
      const items = await Promise.all(
        child.children.map((item, idx) =>
          renderListItem(item, theme, defs, options)
        )
      );
      inner.push(`<${tag} style="${style}">${items.join("")}</${tag}>`);
    }
  }
  return `<li style="${theme.li}">${inner.join("")}</li>`;
}

async function renderTable(
  node: Table,
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderWechatHtmlOptions
) {
  const rows = await Promise.all(
    node.children.map(async (row, rowIndex) => {
      const cells = await Promise.all(
        row.children.map(async (cell: TableCell) => {
          const tag = rowIndex === 0 ? "th" : "td";
          const style = rowIndex === 0 ? theme.th : theme.td;
          const inner = await renderPhrasing(cell.children, theme, defs, options);
          return `<${tag} style="${style}">${inner}</${tag}>`;
        })
      );
      return `<tr>${cells.join("")}</tr>`;
    })
  );
  return `<table style="${theme.table}"><tbody>${rows.join("")}</tbody></table>`;
}

async function renderBlock(
  node: BlockContent,
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderWechatHtmlOptions
): Promise<string> {
  switch (node.type) {
    case "paragraph":
      if (node.children.length === 0) return "";
      return `<p style="${theme.p}">${await renderPhrasing(node.children, theme, defs, options)}</p>`;
    case "heading": {
      // 正文 H1 降级为加粗段落，避免与标题栏重复，也不静默丢内容（如公式行）
      if (options.stripH1 !== false && node.depth === 1) {
        const inner = await renderPhrasing(node.children, theme, defs, options);
        return `<p style="${theme.p}"><strong style="${theme.strong}"><span style="${theme.strong}">${inner}</span></strong></p>`;
      }
      const tag = node.depth === 2 ? "h2" : node.depth === 3 ? "h3" : "h4";
      const style =
        node.depth === 2 ? theme.h2 : node.depth === 3 ? theme.h3 : theme.h4;
      const inner = await renderPhrasing(node.children, theme, defs, options);
      return `<${tag} style="${style}">${inner}</${tag}>`;
    }
    case "blockquote": {
      const inner = await renderBlocks(node.children as BlockContent[], theme, defs, options);
      return `<blockquote style="${theme.blockquote}">${inner}</blockquote>`;
    }
    case "code":
      return `<pre style="${theme.codeBlock}"><code>${escapeHtml(node.value)}</code></pre>`;
    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      const style = node.ordered ? theme.ol : theme.ul;
      const items = await Promise.all(
        node.children.map((item, index) =>
          renderListItem(item, theme, defs, options)
        )
      );
      return `<${tag} style="${style}">${items.join("")}</${tag}>`;
    }
    case "table":
      return renderTable(node, theme, defs, options);
    case "thematicBreak":
      return `<hr style="${theme.hr}" />`;
    case "html":
      if (node.value.trim().startsWith("<!--")) return "";
      return node.value;
    default:
      return "";
  }
}

async function renderBlocks(
  nodes: Content[],
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderWechatHtmlOptions
) {
  const parts: string[] = [];
  for (const node of nodes) {
    if (node.type === "definition") {
      defs.set(node.identifier.toUpperCase(), node);
      continue;
    }
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote" ||
      node.type === "code" ||
      node.type === "list" ||
      node.type === "table" ||
      node.type === "thematicBreak" ||
      node.type === "html"
    ) {
      parts.push(await renderBlock(node, theme, defs, options));
    }
  }
  return parts.join("");
}

export async function renderWechatHtmlFromAst(
  ast: Root,
  options: RenderWechatHtmlOptions = {}
): Promise<string> {
  const theme = getWechatTheme(options.theme ?? "tech-eval");
  const defs = new Map<string, Definition>();
  const inner = await renderBlocks(ast.children, theme, defs, options);
  return `<section style="${theme.section}">${inner}</section>`;
}

export async function renderWechatHtml(
  markdown: string,
  options: RenderWechatHtmlOptions = {}
): Promise<string> {
  const ast = parseMarkdownToAst(markdown);
  return renderWechatHtmlFromAst(ast, options);
}

/** 供剪贴板使用的完整 HTML 文档片段 */
export function wrapClipboardHtml(fragment: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
}
