import type { ContentItem, XiaohongshuGenerationResult } from "@/types/domain";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "@/lib/ai/xiaohongshu-prompt";

export const now = "2026-09-03T01:00:00.000Z";

export const sourceItem: ContentItem = {
  id: "wechat-1",
  workspaceId: "ws_demo",
  topicId: "topic-1",
  platform: "wechat",
  source: "imported",
  title: "公众号标题",
  body: "公众号正文包含 25 项任务。",
  status: "编辑中",
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

export const validResult: XiaohongshuGenerationResult = {
  variants: {
    professional: {
      title: "专业版标题",
      body: "专业版正文\n\n你会怎么做？\n\n#AI工作流 #组织进化 #职场成长 #效率工具 #知识管理",
      cta: "",
      hashtags: ["AI工作流", "组织进化", "职场成长", "效率工具", "知识管理"],
    },
    social: {
      title: "这套方法终于讲清了✨",
      body: "氛围版正文\n\n评论区聊聊你的做法～\n\n#AI工作流 #打工人 #效率提升 #职场干货 #成长思维",
      cta: "",
      hashtags: ["AI工作流", "打工人", "效率提升", "职场干货", "成长思维"],
    },
  },
  visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
  imagePlan: [
    {
      index: 1,
      role: "cover",
      objective: "建立主题",
      overlayText: "AI 不是工具升级",
      composition: "大标题、副标题、中心产品视觉，四周小流程图标",
      prompt: "3:4 竖版小红书暖色图文笔记封面讲解页，暖米白底，非冷色科技风",
    },
    {
      index: 2,
      role: "content",
      objective: "解释变化",
      overlayText: "工作方式正在改变",
      composition: "左右对照讲解页",
      prompt: "3:4 竖版暖色对照讲解页",
    },
    {
      index: 3,
      role: "content",
      objective: "展示步骤",
      overlayText: "三个落地步骤",
      composition: "纵向三步流程页",
      prompt: "3:4 竖版暖色流程讲解页",
    },
    {
      index: 4,
      role: "content",
      objective: "给出案例",
      overlayText: "从任务到闭环",
      composition: "2x2 能力宫格页",
      prompt: "3:4 竖版暖色能力宫格讲解页",
    },
    {
      index: 5,
      role: "ending",
      objective: "总结互动",
      overlayText: "你准备先改哪一步？",
      composition: "大字结论与三点清单",
      prompt: "3:4 竖版暖色收尾讲解页",
    },
  ],
};
