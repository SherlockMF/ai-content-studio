import type { ContentSection, PublishVoice, Workspace } from "@/types/domain";

export const DEFAULT_WORKSPACE: Workspace = {
  id: "ws_demo",
  name: "AI 内容发布工作台",
};

export const DEFAULT_SECTIONS: ContentSection[] = [
  "AI 通识",
  "工具与工作流",
  "组织 AI 进化",
  "行业观察",
];

export const DEFAULT_PUBLISH_VOICE: PublishVoice = {
  id: "voice_1",
  workspaceId: DEFAULT_WORKSPACE.id,
  accountName: "AI 进化笔记",
  voice: "关注 AI 应用与工作方式变化的内容创作者",
  audience: "对 AI 感兴趣的职场人、创业者与团队管理者",
  style: "清晰、克制、有观点，少套话，多用具体场景",
  bannedExpressions: "未来已来、颠覆一切、闭眼入、无脑照做、赋能闭环",
  defaultSections: DEFAULT_SECTIONS,
  conversionNote: "引导关注公众号，偶尔引导私信交流实践经验",
};
