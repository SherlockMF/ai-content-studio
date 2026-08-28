import { z } from "zod";

export const publishVoiceSchema = z.object({
  accountName: z.string().min(2),
  voice: z.string().min(2),
  audience: z.string().min(5),
  style: z.string().min(2),
  bannedExpressions: z.string().min(2),
  defaultSections: z.array(z.string()).min(1),
  conversionNote: z.string().optional(),
});

export const materialSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(3),
  type: z.enum(["观点", "案例", "素材片段", "常用表达", "禁止表达"]),
  tags: z.array(z.string()),
  enabled: z.boolean(),
});

export const harnessSchema = z.object({
  section: z.string().min(2),
  audienceFocus: z.string().min(2),
  goal: z.string().min(2),
  materialIds: z.array(z.string()),
  bannedExtra: z.string(),
  count: z.number().min(1).max(10).optional(),
});

export const topicGenerateSchema = z.object({
  platform: z.enum(["wechat", "douyin", "xiaohongshu"]),
  section: z.string().min(2),
  contentGoal: z.string().min(2),
  contentFormat: z.string().min(2),
  targetAudience: z.string().min(2),
  count: z.number().min(1).max(10),
});
