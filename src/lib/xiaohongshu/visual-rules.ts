/** 全账号统一的小红书配图视觉系统；转换与重规划都强制使用，不得按题材另起科技风。 */
export const XIAOHONGSHU_FIXED_VISUAL_DIRECTION =
  "暖色小红书图文笔记固定视觉系统（全账号统一，不得更换）：暖米白/浅杏底，柔和珊瑚与暖杏点缀，圆角信息块，彩色扁平或软 3D 小图标，清晰中文大标题，留白充足，像可滑动的干货讲解页；禁止冷蓝紫科技感、霓虹、深色赛博、金属科幻光效";

export const XIAOHONGSHU_NO_PAGE_BADGES =
  "整组图片统一不显示页码和角标：四角及边缘不得出现页码、页数分数、单独的装饰序号或进度标记。此规则覆盖原提示词、构图和图中文字中的任何页码要求；图片 index 仅用于文件排序，不得画进图中。正文内有意义的事实数字、步骤编号照常保留。";

/** 单图生图时追加的风格约束 */
export const XIAOHONGSHU_RENDER_STYLE_RULES = [
  "风格硬性要求：小红书干货讲解幻灯片 / 信息图卡片；圆角信息块 + 小图标 + 可读中文大标题；暖米白底；与同组第1-3张讲解页同一风格。",
  "严禁：抽象几何拼贴、文具静物摄影、笔记本样机、名片堆叠、空洞 UI mockup、无文字壁纸、科幻光效、看不清字、把 Cola 画成饮料罐。",
  "竖版约 3:4，安全边距，手机滑动笔记多图观感。",
] as const;

export function withFixedXiaohongshuVisualDirection<T extends { visualDirection: string }>(
  result: T
): T {
  return {
    ...result,
    visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
  };
}
