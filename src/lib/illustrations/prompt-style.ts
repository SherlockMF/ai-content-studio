/** 公众号配图 / 封面 GPT 生图提示词统一规范（全文中文） */
import { PUBLISHED_CONTENT_RULES } from "@/lib/ai/published-content-rules";

export const IMAGE_GPT_PROMPT_RULES = `
生图提示词语言与格式（硬性）：
1. gptPrompt 必须全文使用简体中文撰写，禁止整句英文（产品名如 Parvis、Codex、GIS、Agent 等专有名词可保留英文）。
2. 风格：简约扁平信息图或插画，浅色背景，适合微信公众号正文配图，非写实照片，非 3D 渲染。
3. 须写清：画面主体、构图方式、配色倾向、图中需要出现的中文标注文字。
4. 测评/数据类配图须逐条写出正文表格或段落中的关键数字，禁止只写「标注具体数字」等笼统描述。
5. 图标须为语义隐喻（地图层、流程箭头、账本、盾牌等），禁止无含义的随机几何图形充当图标。
${PUBLISHED_CONTENT_RULES}
`.trim();

/** 兜底 / 模板前缀，保证短提示词也符合风格 */
export const IMAGE_GPT_PROMPT_PREFIX =
  "简约扁平信息图，浅色背景，微信公众号配图，中文标注，非写实照片。";
