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
import { detectImageType, resolveMarkdownImage, PLACEHOLDER_RE } from "@/lib/export-assets";
import { parseMarkdownToAst } from "@/lib/markdown/parse";
import { getWechatTheme, WechatTheme, WechatThemeId } from "@/lib/markdown/wechat-theme";
import { isSafeWechatUrl } from "@/lib/markdown/wechat-html-validation";

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leaf(text: string) {
  return `<span leaf="">${escapeHtml(text)}</span>`;
}

function renderRawHtml(value: string) {
  if (/^\s*<!--[\s\S]*-->\s*$/.test(value)) return "";
  if (/^\s*<br\s*\/?\s*>\s*$/i.test(value)) return "<br />";
  return leaf(value);
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
    if (/^data:image\//i.test(url)) return url;
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
  numberSections?: boolean;
  emphasize?: boolean;
  /** 内嵌图片为 base64（复制到微信剪贴板时必须） */
  embedImages?: boolean;
  /** 跳过正文 H1，避免与公众号标题栏重复 */
  stripH1?: boolean;
  origin?: string;
  imageResolver?: (url: string, alt: string) => Promise<string | null>;
}

interface RenderContext extends RenderWechatHtmlOptions {
  chapterIndex: number;
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
      return leaf(node.value);
    case "strong": {
      const inner = await renderPhrasing(node.children, theme, defs, options);
      // 微信粘贴常剥掉 strong 的 font-weight，内层 span 双保险
      const style = `${theme.strong} ${options.emphasize === false ? "" : theme.highlight ?? ""}`;
      return `<strong style="${theme.strong}"><span style="${style}">${inner}</span></strong>`;
    }
    case "emphasis":
      return `<em style="${theme.em}">${await renderPhrasing(node.children, theme, defs, options)}</em>`;
    case "delete":
      return `<span style="text-decoration: line-through;">${await renderPhrasing(node.children, theme, defs, options)}</span>`;
    case "inlineCode":
      return `<code style="${theme.inlineCode}">${leaf(node.value)}</code>`;
    case "link": {
      if (!isSafeWechatUrl(node.url)) throw new Error("链接协议不受支持，请改用 https 地址");
      const inner = await renderPhrasing(node.children, theme, defs, options);
      return `<a style="${theme.a}" href="${escapeHtml(node.url)}">${inner}</a>`;
    }
    case "linkReference": {
      const def = defs.get(node.identifier.toUpperCase());
      if (!def) return await renderPhrasing(node.children, theme, defs, options);
      const inner = await renderPhrasing(node.children, theme, defs, options);
      if (!isSafeWechatUrl(def.url)) throw new Error("链接协议不受支持，请改用 https 地址");
      return `<a style="${theme.a}" href="${escapeHtml(def.url)}">${inner}</a>`;
    }
    case "break":
      return "<br />";
    case "image": {
      if (!node.url.startsWith("data:") && PLACEHOLDER_RE.test(node.url)) {
        if (options.embedImages) throw new Error("仍有待配图，请先插入本地图片");
        return `<span style="display: block; padding: 20px; border: 1px dashed #b8c2cc; text-align: center; color: #64748b;">${leaf(`待配图：${node.alt || "未命名图片"}`)}</span>`;
      }
      if (!isSafeWechatUrl(node.url, true)) throw new Error(`图片地址不可用：${node.alt || "未命名图片"}，请插入本地图片`);
      const resolver =
        options.imageResolver ??
        ((url) =>
          defaultImageResolver(url, Boolean(options.embedImages), options.origin));
      const src = await resolver(node.url, node.alt ?? "");
      if (!src) {
        throw new Error(`图片无法嵌入：${node.alt || "未命名图片"}，请使用「插入本地图片」替换后重试`);
      }
      if (!isSafeWechatUrl(src, true)) throw new Error("图片协议不受支持，请使用 PNG、JPEG、GIF 或 WebP 图片");
      return `<img style="${theme.img}" src="${escapeHtml(src)}" alt="${escapeHtml(node.alt ?? "")}" />`;
    }
    case "imageReference": {
      const def = defs.get(node.identifier.toUpperCase());
      if (!def) return leaf(node.alt || "图片引用未找到");
      return renderPhrasingNode({ type: "image", url: def.url, alt: node.alt }, theme, defs, options);
    }
    case "html":
      return renderRawHtml(node.value);
    default:
      return "";
  }
}

async function renderListItem(
  node: ListItem,
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderContext
) {
  const inner = await renderBlocks(node.children, theme, defs, options);
  return `<li style="${theme.li}">${inner}</li>`;
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
  return `<section style="max-width: 100%; overflow-x: auto;"><table style="${theme.table}"><tbody>${rows.join("")}</tbody></table></section>`;
}

async function renderBlock(
  node: BlockContent,
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderContext
): Promise<string> {
  switch (node.type) {
    case "paragraph": {
      if (node.children.length === 0) return "";
      const image = node.children.length === 1 ? node.children[0] : null;
      if (theme.caption && (image?.type === "image" || image?.type === "imageReference")) {
        const rendered = await renderPhrasingNode(image, theme, defs, options);
        const caption = image.alt ? `<p style="${theme.caption}">${leaf(image.alt)}</p>` : "";
        return `<section style="margin: 24px 0;">${rendered}${caption}</section>`;
      }
      return `<p style="${theme.p}">${await renderPhrasing(node.children, theme, defs, options)}</p>`;
    }
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
      if (node.depth === 2 && options.numberSections) {
        const number = String(++options.chapterIndex).padStart(2, "0");
        const chapter = theme.chapter ?? { section: "margin: 28px 0 8px;", number: "margin: 0; font-size: 13px; color: #555555;" };
        return `<section style="${chapter.section}"><p style="${chapter.number}">${leaf(number)}</p></section><${tag} style="${style} margin-top: 0;">${inner}</${tag}>`;
      }
      return `<${tag} style="${style}">${inner}</${tag}>`;
    }
    case "blockquote": {
      const inner = await renderBlocks(node.children as BlockContent[], theme, defs, options);
      return `<blockquote style="${theme.blockquote}">${inner}</blockquote>`;
    }
    case "code":
      return `<pre style="${theme.codeBlock}"><code>${leaf(node.value)}</code></pre>`;
    case "list": {
      const tag = node.ordered ? "ol" : "ul";
      const style = node.ordered ? theme.ol : theme.ul;
      const items: string[] = [];
      for (const item of node.children) items.push(await renderListItem(item, theme, defs, options));
      const start = node.ordered && node.start != null ? ` start="${node.start}"` : "";
      return `<${tag} style="${style}"${start}>${items.join("")}</${tag}>`;
    }
    case "table":
      return renderTable(node, theme, defs, options);
    case "thematicBreak":
      return `<hr style="${theme.hr}" />`;
    case "html":
      return `<p style="${theme.p}">${renderRawHtml(node.value)}</p>`;
    default:
      return "";
  }
}

async function renderBlocks(
  nodes: Content[],
  theme: WechatTheme,
  defs: Map<string, Definition>,
  options: RenderContext
) {
  const parts: string[] = [];
  for (const node of nodes) {
    if (node.type === "definition") {
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
  function collectDefinitions(nodes: Content[]) {
    for (const node of nodes) {
      if (node.type === "definition" && !defs.has(node.identifier.toUpperCase())) defs.set(node.identifier.toUpperCase(), node);
      if ("children" in node) collectDefinitions(node.children);
    }
  }
  collectDefinitions(ast.children);
  const inner = await renderBlocks(ast.children, theme, defs, { ...options, chapterIndex: 0 });
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
