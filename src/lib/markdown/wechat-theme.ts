export type WechatThemeId = "tech-eval" | "general";

export interface WechatTheme {
  id: WechatThemeId;
  label: string;
  section: string;
  p: string;
  h2: string;
  h3: string;
  h4: string;
  strong: string;
  em: string;
  a: string;
  blockquote: string;
  codeBlock: string;
  inlineCode: string;
  ul: string;
  ol: string;
  li: string;
  table: string;
  th: string;
  td: string;
  img: string;
  hr: string;
}

/** 技术测评稿：表格 13px 居中；加粗用 bold（微信常剥掉 700/!important） */
export const WECHAT_THEME_TECH_EVAL: WechatTheme = {
  id: "tech-eval",
  label: "技术测评",
  section:
    "font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; font-size: 16px; line-height: 1.75; color: #333333; word-wrap: break-word;",
  p: "margin: 0 0 1.75em; font-size: 16px; line-height: 1.75; color: #333333; text-align: justify; letter-spacing: 0.02em;",
  h2: "margin: 28px 0 16px; font-size: 18px; line-height: 1.5; font-weight: bold; color: #000000; text-align: left; border-left: 4px solid #07c160; padding-left: 10px;",
  h3: "margin: 24px 0 12px; font-size: 17px; line-height: 1.5; font-weight: bold; color: #000000; text-align: left;",
  h4: "margin: 20px 0 10px; font-size: 16px; line-height: 1.5; font-weight: bold; color: #000000; text-align: left;",
  strong:
    "font-weight: bold; color: #000000; -webkit-text-stroke: 0.35px #000000;",
  em: "font-style: italic; color: #444444;",
  a: "color: #576b95; text-decoration: underline;",
  blockquote:
    "margin: 16px 0; padding: 12px 16px; background: #f7f7f7; border-left: 4px solid #d9d9d9; color: #555555; font-size: 15px; line-height: 1.7;",
  codeBlock:
    "display: block; margin: 16px 0; padding: 12px; background: #f5f5f5; border-radius: 4px; font-family: Consolas, Monaco, monospace; font-size: 13px; line-height: 1.6; color: #333333; white-space: pre-wrap; word-break: break-all;",
  inlineCode:
    "padding: 2px 6px; background: #f5f5f5; border-radius: 3px; font-family: Consolas, Monaco, monospace; font-size: 14px; color: #c7254e;",
  ul: "margin: 0 0 16px; padding-left: 24px; font-size: 16px; line-height: 1.75; color: #333333; list-style-type: disc; list-style-position: outside;",
  ol: "margin: 0 0 16px; padding-left: 28px; font-size: 16px; line-height: 1.75; color: #333333; list-style-type: decimal; list-style-position: outside;",
  li: "margin: 6px 0; display: list-item;",
  table:
    "margin: 16px auto; border-collapse: collapse; width: 100%; max-width: 100%; font-size: 13px; line-height: 1.5; table-layout: auto;",
  th: "border: 1px solid #dddddd; padding: 8px 10px; text-align: center; font-weight: bold; color: #000000; background-color: #f7f7f7; font-size: 13px;",
  td: "border: 1px solid #dddddd; padding: 8px 10px; text-align: center; color: #333333; font-size: 13px;",
  img: "display: block; max-width: 100%; height: auto; margin: 16px auto; border-radius: 4px;",
  hr: "border: none; border-top: 1px solid #eeeeee; margin: 24px 0;",
};

export const WECHAT_THEME_GENERAL: WechatTheme = {
  ...WECHAT_THEME_TECH_EVAL,
  id: "general",
  label: "普通分享",
  h2: "margin: 28px 0 16px; font-size: 18px; line-height: 1.5; font-weight: bold; color: #000000; text-align: center;",
};

export const WECHAT_THEMES: WechatTheme[] = [WECHAT_THEME_TECH_EVAL, WECHAT_THEME_GENERAL];

export function getWechatTheme(id: WechatThemeId = "tech-eval") {
  return id === "general" ? WECHAT_THEME_GENERAL : WECHAT_THEME_TECH_EVAL;
}
