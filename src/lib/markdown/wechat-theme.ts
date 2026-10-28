export type WechatThemeId = "tech-eval" | "general" | "tech-minimal" | "tutorial-cards" | "editorial";

export interface WechatLayoutSettings {
  theme: WechatThemeId;
  numberSections: boolean;
  emphasize: boolean;
}

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
  description?: string;
  accent?: string;
  paper?: string;
  chapter?: { section: string; number: string };
  highlight?: string;
  caption?: string;
}

/** 技术测评稿：表格 13px 居中；加粗用 bold（微信常剥掉 700/!important） */
export const WECHAT_THEME_TECH_EVAL: WechatTheme = {
  id: "tech-eval",
  label: "技术测评",
  section:
    "font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif; font-size: 16px; line-height: 1.75; color: #333333; word-wrap: break-word; padding: 12px 16px; box-sizing: border-box;",
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

const caption = "margin: 8px 0 24px; font-size: 12px; line-height: 1.6; color: #697386; text-align: center;";
const readingParagraph = "margin: 0 0 24px; font-size: 16px; line-height: 1.85; color: #27313b; text-align: left; letter-spacing: 0.02em;";

const TECH_MINIMAL: WechatTheme = {
  ...WECHAT_THEME_TECH_EVAL,
  id: "tech-minimal",
  label: "科技极简",
  description: "冷灰蓝 · 科技评论与专业观点",
  accent: "#315b85",
  paper: "#ffffff",
  section: `${WECHAT_THEME_TECH_EVAL.section} padding: 12px 16px; background: #ffffff; box-sizing: border-box;`,
  p: readingParagraph,
  h2: "margin: 32px 0 20px; padding-bottom: 12px; border-bottom: 1px solid #cdd8e3; font-size: 22px; font-weight: bold; line-height: 1.5; color: #182c40;",
  h3: "margin: 28px 0 12px; font-size: 17px; font-weight: bold; line-height: 1.6; color: #182c40;",
  chapter: {
    section: "margin: 36px 0 8px; padding-top: 12px; border-top: 2px solid #315b85;",
    number: "margin: 0; font-size: 12px; line-height: 1.5; letter-spacing: 2px; font-weight: bold; color: #315b85;",
  },
  highlight: "border-bottom: 2px solid #8faec9;",
  blockquote: "margin: 24px 0; padding: 18px 20px 1px; background: #f0f4f8; border-left: 3px solid #315b85;",
  a: "color: #315b85; text-decoration: underline;",
  codeBlock: "display: block; margin: 20px 0; padding: 16px; background: #eef2f6; font-family: Consolas, Monaco, monospace; font-size: 13px; line-height: 1.7; color: #182c40; white-space: pre-wrap; overflow-wrap: anywhere;",
  caption,
};

const TUTORIAL_CARDS: WechatTheme = {
  ...WECHAT_THEME_TECH_EVAL,
  id: "tutorial-cards",
  label: "教程卡片",
  description: "青绿步骤卡 · 教程与工具清单",
  accent: "#17695c",
  paper: "#ffffff",
  section: `${WECHAT_THEME_TECH_EVAL.section} padding: 12px 16px; background: #ffffff; box-sizing: border-box;`,
  p: readingParagraph,
  h2: "margin: 28px 0 20px; padding: 14px 16px; border-left: 4px solid #17695c; background: #edf6f2; font-size: 20px; font-weight: bold; line-height: 1.6; color: #163e36;",
  h3: "margin: 24px 0 12px; font-size: 17px; font-weight: bold; line-height: 1.6; color: #17695c;",
  chapter: {
    section: "margin: 32px 0 0; padding: 10px 16px; background: #17695c; border-radius: 8px 8px 0 0;",
    number: "margin: 0; font-size: 13px; font-weight: bold; line-height: 1.5; letter-spacing: 2px; color: #ffffff;",
  },
  highlight: "background: #e1f0e8; padding: 1px 3px; border-radius: 2px;",
  blockquote: "margin: 24px 0; padding: 18px 18px 1px; background: #f3f8f5; border: 1px solid #bfd7cb; border-radius: 8px;",
  a: "color: #17695c; text-decoration: underline;",
  th: `${WECHAT_THEME_TECH_EVAL.th} background-color: #edf6f2; color: #163e36;`,
  img: "display: block; max-width: 100%; height: auto; margin: 20px auto 8px; border-radius: 8px;",
  caption,
};

const EDITORIAL: WechatTheme = {
  ...WECHAT_THEME_TECH_EVAL,
  id: "editorial",
  label: "深度观点",
  description: "暖纸色 · 长文分析与案例复盘",
  accent: "#924830",
  paper: "#fffdf8",
  section: `${WECHAT_THEME_TECH_EVAL.section} padding: 20px 18px; background: #fffdf8; box-sizing: border-box;`,
  p: `${readingParagraph} color: #3c332e; line-height: 1.95;`,
  h2: "margin: 36px 0 24px; padding-bottom: 14px; border-bottom: 2px solid #924830; font-family: 'Songti SC', SimSun, serif; font-size: 23px; line-height: 1.6; font-weight: bold; color: #38271f;",
  h3: "margin: 28px 0 14px; font-size: 17px; line-height: 1.6; font-weight: bold; color: #38271f;",
  chapter: {
    section: "margin: 40px 0 8px;",
    number: "margin: 0; font-family: Georgia, serif; font-size: 24px; line-height: 1.5; color: #924830;",
  },
  highlight: "border-bottom: 2px solid #c79c78;",
  blockquote: "margin: 30px 0; padding: 20px 14px 1px; border-top: 1px solid #cdb9a6; border-bottom: 1px solid #cdb9a6; background: #faf3e8;",
  a: "color: #924830; text-decoration: underline;",
  th: `${WECHAT_THEME_TECH_EVAL.th} background-color: #f3eadc;`,
  hr: "border: none; border-top: 1px solid #cdb9a6; margin: 32px 0;",
  caption: `${caption} color: #78695b;`,
};

export const WECHAT_THEMES: WechatTheme[] = [WECHAT_THEME_TECH_EVAL, WECHAT_THEME_GENERAL, TECH_MINIMAL, TUTORIAL_CARDS, EDITORIAL];

export function getWechatTheme(id: WechatThemeId = "tech-eval") {
  return WECHAT_THEMES.find(theme => theme.id === id) ?? WECHAT_THEME_TECH_EVAL;
}

export function normalizeWechatLayout(value: unknown): WechatLayoutSettings {
  const input = value && typeof value === "object" ? value as Partial<WechatLayoutSettings> : {};
  return {
    theme: getWechatTheme(input.theme).id,
    numberSections: typeof input.numberSections === "boolean" ? input.numberSections : false,
    emphasize: typeof input.emphasize === "boolean" ? input.emphasize : true,
  };
}
