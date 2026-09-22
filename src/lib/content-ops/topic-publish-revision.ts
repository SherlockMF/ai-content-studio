/**
 * 选题 / 发布 / 改稿运营规则（项目内生效，不依赖 Cursor）。
 * 人读完整清单见 docs/playbooks/content-topic-publish-revision.md
 */

/** 选题与热点方向生成时注入 */
export const TOPIC_SELECTION_RULES = `
【选题结构（流量复盘沉淀）】
1. 优先：场景痛点、可验证案例/盲测/自建工具、有证据的争议判断。
2. 控制：抽象框架、能力模型总论、连续纯观点文；同类抽象观点不要连出多条。
3. 标题须短、冲突点或痛点清晰，能在手机封面缩略图里一眼读完；禁止半截标题。
4. 与已发稿重复主题时必须换实质角度（新事实/新结论），禁止换皮重发。
`.trim();

/** 小红书转换、出稿、质检相关提示词注入 */
export const XIAOHONGSHU_COMPLIANCE_RULES = `
【小红书合规（流量复盘沉淀）】
1. 禁止站外引流：微信号、QQ、手机号、邮箱、URL、二维码、邀请码、含义不清的数字/暗号串。
2. 禁止外站 logo、水印、评测导流、福利诱饵引导去其他平台。
3. 从公众号改编时做平台版清洗，删除导流段与联系方式；不要原样搬公众号私域话术。
4. 封面/图中文字用大字痛点，少用信息密度过高的产品拼图当封面主信息。
5. 有阅读无互动时优先强化开头钩子与结论前置，不要用同题再发冲量。
`.trim();

/** 公众号出稿/改稿提示词注入（贴图为一文双发官方能力） */
export const WECHAT_PUBLISH_OPS_RULES = `
【公众号发布习惯（流量复盘沉淀）】
1. 标题定稿后再交付发布字段；少做发后改核心标题。
2. 一文双发（文章→官方贴图）可保留：贴图优先推非粉丝；贴图封面要用大字痛点，可读性优先于精美信息图。
3. 正文前三屏给结论或可执行一步；有量无互动时改开头，不靠同题再发冲量。
4. 案例/工具文与观点文轮换，避免连续多条纯抽象判断。
`.trim();

const DIVERSION_PATTERNS: Array<{ id: string; re: RegExp; label: string }> = [
  { id: "wechat-id", re: /微信号|加我微信|微信：\s*\w|vx[:：]|v信/i, label: "疑似微信号/加微信引导" },
  { id: "qq", re: /\bQQ[:：]?\s*\d{5,}|加QQ/i, label: "疑似 QQ 联系方式" },
  { id: "phone", re: /(?<!\d)(1[3-9]\d{9})(?!\d)/, label: "疑似手机号" },
  { id: "email", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, label: "疑似邮箱" },
  { id: "url", re: /https?:\/\/|www\./i, label: "疑似外链 URL" },
  { id: "qr", re: /二维码|扫码添加|扫一扫加/, label: "疑似二维码引导" },
  { id: "invite", re: /邀请码|暗号|房间密码/, label: "疑似邀请码/暗号" },
];

export type DiversionHit = { id: string; label: string };

/** 检测小红书文案中的站外引流风险（规则化，供发布检查使用） */
export function detectOffPlatformDiversion(text: string): DiversionHit[] {
  const sample = text.trim();
  if (!sample) return [];
  return DIVERSION_PATTERNS.filter((item) => item.re.test(sample)).map(({ id, label }) => ({
    id,
    label,
  }));
}

export function formatDiversionHint(hits: DiversionHit[]): string | undefined {
  if (!hits.length) return undefined;
  return `存在站外引流风险：${hits.map((h) => h.label).join("、")}。小红书可能限制推荐和搜索，请删除后再发`;
}
