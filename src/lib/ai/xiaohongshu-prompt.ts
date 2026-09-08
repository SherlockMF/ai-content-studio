import type {
  XiaohongshuImagePrompt,
  XiaohongshuOutline,
  XiaohongshuTone,
  XiaohongshuVariant,
} from "@/types/domain";
import { BLINDTEST_XHS_ICON_PROMPT } from "@/lib/illustrations/cover-prompt-style";

/** 全账号统一的小红书配图视觉系统；转换与重规划都强制使用，不得按题材另起科技风。 */
export const XIAOHONGSHU_FIXED_VISUAL_DIRECTION =
  "暖色小红书图文笔记固定视觉系统（全账号统一，不得更换）：暖米白/浅杏底，柔和珊瑚与暖杏点缀，圆角信息块，彩色扁平或软 3D 小图标，清晰中文大标题，留白充足，像可滑动的干货讲解页；禁止冷蓝紫科技感、霓虹、深色赛博、金属科幻光效";

export const XIAOHONGSHU_NO_PAGE_BADGES =
  "整组图片统一不显示页码和角标：四角及边缘不得出现页码、页数分数、单独的装饰序号或进度标记。此规则覆盖原提示词、构图和图中文字中的任何页码要求；图片 index 仅用于文件排序，不得画进图中。正文内有意义的事实数字、步骤编号照常保留。";

export function withFixedXiaohongshuVisualDirection<T extends { visualDirection: string }>(
  result: T
): T {
  return {
    ...result,
    visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
  };
}

export function buildXiaohongshuReviewSignature(input: {
  sourceBody: string;
  tone: XiaohongshuTone;
  variant: XiaohongshuVariant;
  visualDirection: string;
  imagePlan: XiaohongshuImagePrompt[];
}): string {
  return JSON.stringify({
    sourceBody: input.sourceBody,
    tone: input.tone,
    variant: input.variant,
    visualDirection: input.visualDirection,
    imagePlan: input.imagePlan,
  });
}

export function buildXiaohongshuOutlinePrompt(input: {
  title: string;
  digest?: string;
  body: string;
  cta?: string;
  supplementaryNotes?: string;
}): string {
  return `Task: extractXiaohongshuOutline
从下面的公众号长文抽出小红书改编大纲。只抽取，不写正文。

输出 JSON 格式：
{
  "subjects": ["对比或测评主体1", "主体2"],
  "keyFacts": ["必须保留的数字或案例"],
  "roundConclusions": ["各轮或各主体结论摘要"],
  "overallJudgment": "总判断一句话",
  "optionalDetails": ["可压缩的次要细节"]
}

规则：
1. subjects 必须覆盖原文点名的全部对比主体（产品、模型、Agent、案例对象等），不得漏项。
2. keyFacts 只保留改编时必须出现的数字、实体、边界结论。
3. roundConclusions 概括测试轮次或分主体结论，不要扩写。
4. optionalDetails 放可删减细节；字数不够时优先砍这里。
5. 禁止虚构原文没有的主体、数字或结论。

--- 公众号原文 ---
标题：${input.title}
摘要：${input.digest || "（无）"}
正文：
${input.body}
互动收尾：${input.cta || "（无）"}
补充资料：${input.supplementaryNotes || "（无）"}
--- 原文结束 ---`;
}

export function buildXiaohongshuConversionPrompt(input: {
  title: string;
  digest?: string;
  body: string;
  cta?: string;
  supplementaryNotes?: string;
  outline: XiaohongshuOutline;
}): string {
  const subjectText = input.outline.subjects.join("、");
  const isBlindtest = /Parvis|Codex|WorkBuddy|Cola/i.test(subjectText);
  const brandIconBlock = isBlindtest
    ? `\n【盲测产品图标（强制）】\n${BLINDTEST_XHS_ICON_PROMPT}\n凡出现产品对比/封面分列，prompt 中必须写出上述 logo 形态；禁止自造无关几何图标。\n`
    : "";

  return `Task: generateXiaohongshuArticle
把下面的公众号长文改编为一篇小红书图文稿件，同时输出两套可切换文案和一组共用的生图提示词。

输出 JSON 格式：
{
  "variants": {
    "professional": {
      "title": "专业轻表达标题",
      "body": "正文（含轻互动收尾，末尾必须带 #话题）",
      "cta": "",
      "hashtags": ["话题1", "话题2"]
    },
    "social": {
      "title": "强氛围标题",
      "body": "正文（含轻互动收尾，末尾必须带 #话题）",
      "cta": "",
      "hashtags": ["话题1", "话题2"]
    }
  },
  "visualDirection": "必须原样输出固定视觉系统全文（见下方，禁止改写）",
  "imagePlan": [
    {
      "index": 1,
      "role": "cover",
      "objective": "本张画面职责",
      "overlayText": "精确中文图中文字",
      "composition": "构图说明（封面命题、对照、界面截图感、能力宫格、清单收尾等）",
      "prompt": "可直接交给 GPT 的完整中文生图提示词"
    }
  ]
}

公众号正文是唯一事实基线。保留所有数字、实体、案例和结论边界。
禁止虚构“亲测”、使用时长、结果提升、个人身份或第一人称经历。
禁止站外引流、求赞求关注或私信引导。
硬性字数：每个版本 title 不超过 20 字；body 正文不超过 1000 字（按字符计，含文末 #话题，不含 title）。professional 与 social 都写精炼图文笔记，宁可短而准，禁止为凑字数灌水。
必须按大纲写稿：subjects 中每个主体正文至少有一段独立结论；若开场声明测了 N 个主体，正文主体数必须等于 N。
字数不够时优先压缩 optionalDetails，不得省略 subjects、keyFacts、roundConclusions 与 overallJudgment。

【正文一体（强制）】
用户只会复制「标题」和「正文」两段去小红书：
1. title：短准有钩子，≤20 字。
2. body：讲解正文 + 一句轻互动收尾 + 文末 5～8 个话题；话题必须写成 #话题名（带 #、空格分隔），否则粘贴后标签无效。
3. cta 字段固定输出空字符串 ""；不要另起互动收尾字段。
4. hashtags 数组仍输出 5～8 个不带 # 的话题名，且必须与 body 文末 #话题一致。
5. 预留文末话题空间：正文主体写完后至少留约 80 字给收尾与 #话题，避免被截断。

【文案结构（两套都必须遵守）】
目标是小红书「图文笔记」正文：可扫读的讲解文案，不是概念海报文案。
1. 开头 1～2 句抛结论或反常识钩子，可带 1 个 emoji（如 🚀）。
2. 中间用「emoji + 短标题」分模块展开（如 🎨 / 📝 / 📊 / 💻 / ⚡），每模块 2～4 句，讲清这是什么、为什么重要、怎么用；整体控制在 1000 字内（含话题）。
3. 关键数字、主体名、对比结论嵌进模块，像产品功能清单，不要大段空讲概念。
4. 结尾 1～2 句收束 + 轻互动提问，直接写在 body 里；不要营销腔。
5. social 可比 professional 更口语、更多分行，但仍保持模块结构，禁止只有情绪没有信息。
6. body 最后一行（或最后一段）必须是：#话题1 #话题2 #话题3 #话题4 #话题5（可到 8 个）。

【固定视觉系统（全账号统一，强制）】
visualDirection 必须原样输出下面这一整句，一个字都不要改、不要按题材另起风格：
${XIAOHONGSHU_FIXED_VISUAL_DIRECTION}

【视觉方向与配图（暖色图文笔记讲解页）】
目标形态：一组 3:4 竖版「可滑动讲解页」，像产品介绍/干货分享笔记：暖米白底、大标题、短副文、柔和彩色小图标、圆角信息块、界面示意或能力宫格。气质偏温暖、好读、生活感知识分享，不要冷冰冰科技海报。
图片默认 3:4、1080×1440；首张 role=cover，末张 role=ending，index 从 1 连续递增。
${XIAOHONGSHU_NO_PAGE_BADGES}
每张 prompt 都必须包含上述无页码角标要求。
根据内容自动规划 5～8 张，中间 role=content，每张只讲一个点，像笔记多图第 1～N 页。
图片优先覆盖：封面总命题、这是什么/为什么重要、主体或概念对照、关键能力拆解、界面或场景示意、结论收束。

每张画面优先选用这些「笔记页」结构：
- 封面页：大标题 + 一句副标题 + 中心主题视觉 + 周边小流程图标
- 定义/对照页：多产品或旧认知 vs 新认知的并排对照
- 人群/场景页：谁在用、解决什么问题（可用简洁人物示意，不要写真风）
- 界面示意页：模拟工具界面、白板贴纸、旅程图、能力四宫格（每格图标+名称+一句说明）
- 收尾页：大字结论 + 3 条要点

明确禁止（反例）：
- 冷蓝紫/霓虹/深色赛博科技感、金属光效、六边形枢纽架构图、「Everything is a Plugin」类概念海报
- 纯抽象光效/粒子墙/几何漂浮、看不清字的装饰排版、与正文无关的风景写真
允许软 3D 图标与轻阴影，但整体必须暖、干净、像干货笔记配图；一眼能读标题和要点。
图中文字（overlayText）必须短、准、大：标题级中文，可含关键英文专有名词；prompt 里要写出这些字并要求清晰可辨。
每张 prompt 开头必须复述固定视觉系统关键词（暖米白底、珊瑚/暖杏点缀、非科技感），并写明「竖版 3:4 小红书暖色图文笔记讲解页，非科幻概念海报，非冷色科技风」。
${brandIconBlock}
--- 改编大纲 ---
subjects：${subjectText}
keyFacts：${input.outline.keyFacts.join("；")}
roundConclusions：${input.outline.roundConclusions.join("；")}
overallJudgment：${input.outline.overallJudgment}
optionalDetails：${(input.outline.optionalDetails ?? []).join("；") || "（无）"}
--- 大纲结束 ---

--- 公众号原文 ---
标题：${input.title}
摘要：${input.digest || "（无）"}
正文：
${input.body}
互动收尾：${input.cta || "（无）"}
补充资料：${input.supplementaryNotes || "（无）"}
--- 原文结束 ---`;
}

export function buildXiaohongshuReviewPrompt(input: {
  sourceBody: string;
  title: string;
  body: string;
  cta: string;
  hashtags: string[];
  visualDirection: string;
  imagePlan: XiaohongshuImagePrompt[];
  targetAudience: string;
}): string {
  return `Task: reviewXiaohongshuContent
请对以下小红书图文做发布前质检，输出 score（0–100）和 issues 列表。

检查维度（每条 issue 填 dimension / severity / suggestion）：
1. 事实一致性：逐项对照来源公众号正文，检查数字、实体、案例、观点和结论边界是否被改变或扩写
2. 虚构个人经历：检查是否凭空出现“亲测”、使用时长、身份、结果提升或第一人称体验
3. 主体覆盖：对照来源正文点名的对比/测评主体，检查小红书正文是否每个主体都有独立结论；若开场声称测了 N 个主体，正文主体数是否等于 N
4. 标题与正文：标题是否准确对应正文，是否存在标题党、夸张承诺或站外引流；标题是否超过 20 字，正文（含文末 #话题）是否超过 1000 字（超限标 high）；正文末尾是否有 5～8 个带 # 的话题
5. 移动端可读性：段落节奏、表达密度和互动收尾是否适合 ${input.targetAudience}；是否采用「emoji 分模块 + 短段落」的讲解型结构，而不是大段散文；互动收尾应在正文内，不另起字段
6. 话题相关性：正文中的 #话题（5～8 个）是否都与正文直接相关
7. 图片规划：图片数量和顺序是否完整；单图是否像暖色小红书图文笔记讲解页；visualDirection 是否仍是固定暖色系统（暖米白底、珊瑚/暖杏点缀），有无滑向冷蓝紫科技感、霓虹或深色赛博；图中文字是否准确；整组是否像同一套可滑动笔记多图

severity：high=发布前必须改，medium=建议改，low=可选优化

--- 来源公众号正文（事实基线）---
${input.sourceBody}
--- 来源正文结束 ---

--- 小红书稿件 ---
标题：${input.title}
正文：
${input.body}
话题（从正文提取）：${input.hashtags.join("、")}
视觉方向：${input.visualDirection}
图片规划：
${JSON.stringify(input.imagePlan, null, 2)}
--- 小红书稿件结束 ---`;
}
