import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_PUBLISH_VOICE } from "@/lib/mock-data";
import { validResult } from "@/lib/xiaohongshu/test-fixtures";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "./xiaohongshu-prompt";
import { runXiaohongshuTwoPassConversion } from "./xiaohongshu-conversion";

const sampleOutline = {
  subjects: ["Parvis", "Codex", "Cola", "WorkBuddy"],
  keyFacts: ["25 项任务"],
  roundConclusions: ["专项强", "自主弱"],
  overallJudgment: "适合工具平台",
  optionalDetails: ["细节"],
};

test("two-pass conversion extracts outline then writes with that outline", async () => {
  const calls: string[] = [];
  const result = await runXiaohongshuTwoPassConversion({
    sourceContent: {
      id: "wechat-1",
      title: "盲测标题",
      body: "测了四个 agent",
    },
    voice: DEMO_PUBLISH_VOICE,
    extractOutline: async () => {
      calls.push("outline");
      return sampleOutline;
    },
    writeArticle: async (outline) => {
      calls.push(`write:${outline.subjects.join(",")}`);
      return {
        ...validResult,
        visualDirection: "冷蓝紫科技感随便写的方向",
      };
    },
  });

  assert.deepEqual(calls, ["outline", "write:Parvis,Codex,Cola,WorkBuddy"]);
  assert.equal(result.visualDirection, XIAOHONGSHU_FIXED_VISUAL_DIRECTION);
  assert.deepEqual(result.variants, validResult.variants);
  assert.deepEqual(result.imagePlan, validResult.imagePlan);
});
