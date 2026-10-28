const ALLOWED_TAGS = new Set("section p span strong em code a br img pre ul ol li table tbody tr th td h2 h3 h4 blockquote hr".split(" "));
const VOID_TAGS = new Set(["br", "img", "hr"]);
const BLOCK_TAGS = new Set("section p pre ul ol table h2 h3 h4 blockquote hr".split(" "));
const ALLOWED_ATTRIBUTES = new Set(["style", "leaf", "href", "src", "alt", "title", "start"]);

export function isSafeWechatUrl(value: string, image = false) {
  const url = value.trim();
  if (!url || /[\u0000-\u0020\u007f<>\\]/.test(url)) return false;
  if (image && /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z\d+/]+=*$/i.test(url)) return true;
  if (/^https?:\/\//i.test(url)) {
    try { return Boolean(new URL(url).hostname); } catch { return false; }
  }
  if (!image && /^mailto:[^:]+@[^:]+$/i.test(url)) return true;
  return /^(?:\/(?!\/)|\.\.?\/|#)/.test(url) && !url.includes(":");
}

export interface WechatHtmlValidation {
  errors: string[];
  warnings: string[];
}

/** 检查本渲染器生成的片段，不用于清洗外部任意 HTML。 */
export function validateWechatHtml(fragment: string): WechatHtmlValidation {
  const errors = new Set<string>();
  const warnings = new Set<string>();
  const stack: Array<{ tag: string; leaf: boolean }> = [];
  const tokens = /<\/?([a-z][a-z\d]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  let offset = 0;
  const checkText = (text: string) => {
    if (text.trim() && !stack.some(node => node.leaf)) errors.add("正文文字缺少 leaf 包裹");
  };
  if (!/^<section\b/i.test(fragment.trim()) || !/<\/section>$/i.test(fragment.trim())) {
    errors.add("正文需要完整的 section 容器");
  }
  for (const match of fragment.matchAll(tokens)) {
    checkText(fragment.slice(offset, match.index));
    offset = match.index + match[0].length;
    const tag = match[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) errors.add(`不支持的标签：${tag}`);
    if (match[0].startsWith("</")) {
      if (stack.pop()?.tag !== tag) errors.add("HTML 标签未正确闭合");
      continue;
    }
    if (BLOCK_TAGS.has(tag) && stack.some(node => node.tag === "p")) errors.add("段落内不能嵌套块级内容");
    const attrs = new Map<string, string>();
    for (const attr of match[2].matchAll(/([^\s=/'">]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const name = attr[1].toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4] ?? "";
      attrs.set(name, value);
      if (!ALLOWED_ATTRIBUTES.has(name)) errors.add(`不支持的属性：${name}`);
    }
    const style = attrs.get("style") ?? "";
    if (/(?:position\s*:\s*(?:fixed|absolute|sticky)|display\s*:\s*(?:grid|flex)|float\s*:|var\s*\(|@(?:media|import|keyframes)|url\s*\(|expression\s*\(|\\)/i.test(style)) {
      errors.add("样式包含公众号不支持的布局或外部资源");
    }
    if (/(?:linear|radial|conic)-gradient\s*\(/i.test(style)) warnings.add("渐变背景需要核对微信暗色模式显示");
    if (attrs.has("href") && !isSafeWechatUrl(attrs.get("href")!)) errors.add("链接协议不受支持");
    if (tag === "img" && !isSafeWechatUrl(attrs.get("src") ?? "", true)) errors.add("图片地址不受支持");
    if (tag === "table") warnings.add("含表格，请核对手机端宽度和粘贴后的列布局");
    if (!VOID_TAGS.has(tag)) stack.push({ tag, leaf: tag === "span" && attrs.has("leaf") });
  }
  checkText(fragment.slice(offset));
  if (stack.length) errors.add("HTML 标签未正确闭合");
  return { errors: [...errors], warnings: [...warnings] };
}
