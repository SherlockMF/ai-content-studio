import { DEFAULT_SECTIONS } from "@/lib/mock-data";
import { ContentSection, PublishVoice } from "@/types/domain";

export interface PublishVoicePreset {
  id: string;
  label: string;
  summary: string;
  voice: Omit<PublishVoice, "id" | "workspaceId">;
}

export const PUBLISH_VOICE_PRESETS: PublishVoicePreset[] = [
  {
    id: "ai-evolution",
    label: "AI 应用观察",
    summary: "综合型 · 职场人与创业者 · 清晰有观点",
    voice: {
      accountName: "AI 进化笔记",
      voice: "关注 AI 应用与工作方式变化的内容创作者",
      audience: "对 AI 感兴趣的职场人、创业者与团队管理者",
      style: "清晰、克制、有观点，少套话，多用具体场景",
      bannedExpressions: "未来已来、颠覆一切、闭眼入、无脑照做、赋能闭环",
      defaultSections: DEFAULT_SECTIONS,
      conversionNote: "引导关注公众号，偶尔引导私信交流实践经验",
    },
  },
  {
    id: "tool-workflow",
    label: "工具与工作流",
    summary: "实操向 · 效率党与创作者 · 步骤清楚可复用",
    voice: {
      accountName: "AI 工作流手记",
      voice: "专注 AI 工具测评与真实工作流搭建",
      audience: "想用 AI 提效的内容创作者、产品经理与独立开发者",
      style: "步骤清楚、可复现，先说场景再说做法，少空泛展望",
      bannedExpressions: "神器、必学、吊打、碾压、一键搞定一切",
      defaultSections: ["工具与工作流", "AI 通识"] as ContentSection[],
      conversionNote: "文末引导收藏工具清单或关注获取更新",
    },
  },
  {
    id: "org-evolution",
    label: "组织 AI 进化",
    summary: "管理向 · 团队负责人 · 讲清落地与协作",
    voice: {
      accountName: "组织进化札记",
      voice: "帮助团队把 AI 从个人技巧变成组织能力",
      audience: "团队管理者、HR、业务负责人与咨询顾问",
      style: "偏管理与落地，讲清角色分工、流程变化与协作方式",
      bannedExpressions: "全员 AI 化、组织颠覆、降本增效闭环、无脑上 Agent",
      defaultSections: ["组织 AI 进化", "工具与工作流"] as ContentSection[],
      conversionNote: "引导管理者私信交流落地经验",
    },
  },
  {
    id: "industry-watch",
    label: "行业观察",
    summary: "分析向 · 从业者与决策者 · 有判断有边界",
    voice: {
      accountName: "AI 行业观察",
      voice: "从真实项目与产品变化里提炼行业判断",
      audience: "AI 从业者、创业者、投资人与重度关注者",
      style: "有判断、有边界，敢下结论也敢写局限，避免新闻稿腔",
      bannedExpressions: "震惊、史诗级、彻底改变行业、下一个风口",
      defaultSections: ["行业观察", "AI 通识"] as ContentSection[],
      conversionNote: "引导关注获取后续深度分析",
    },
  },
  {
    id: "ai-literacy",
    label: "轻松科普",
    summary: "入门向 · 泛职场用户 · 好懂不装懂",
    voice: {
      accountName: "AI 白话笔记",
      voice: "用大白话讲清 AI 能做什么、不能做什么",
      audience: "刚接触 AI 的职场人与普通读者",
      style: "好懂、不装懂，类比多、术语少，一篇只讲一个概念",
      bannedExpressions: "底层逻辑、认知升级、降维打击、弯道超车",
      defaultSections: ["AI 通识"] as ContentSection[],
      conversionNote: "引导关注，适合连载入门系列",
    },
  },
];

export function findPublishVoicePreset(voice: PublishVoice): PublishVoicePreset {
  const matched = PUBLISH_VOICE_PRESETS.find(
    (preset) =>
      preset.voice.accountName === voice.accountName &&
      preset.voice.voice === voice.voice
  );
  return matched ?? PUBLISH_VOICE_PRESETS[0];
}

export function applyPublishVoicePreset(
  preset: PublishVoicePreset,
  current: PublishVoice
): PublishVoice {
  return {
    ...current,
    ...preset.voice,
  };
}
