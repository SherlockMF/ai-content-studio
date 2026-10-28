import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDraftOverlayToItems,
  shouldApplyDraftOverlay,
  type ProjectDraftOverlay,
} from "./draft-overlays";
import type { ContentItem } from "@/types/domain";

const overlay: ProjectDraftOverlay = {
  id: "ai-task-cost",
  titleIncludes: "AI 项目到底赚不赚钱",
  platform: "wechat",
  bodyUrl: "/draft-overlays/ai-task-cost.body.md",
};

const overlayBody = `![公众号封面](/article-assets/img_aaa.png)

正文。

![成本](/article-assets/img_bbb.png)
`;

test("待替换占位时应灌入项目正文", () => {
  assert.equal(
    shouldApplyDraftOverlay("![封面](待替换-公众号配图-1)\n\n文字", overlayBody),
    true
  );
});

test("已含项目配图 URL 时不重复灌入", () => {
  assert.equal(shouldApplyDraftOverlay(overlayBody, overlayBody), false);
});

test("按标题匹配并替换公众号草稿", () => {
  const items = [
    {
      id: "a",
      platform: "wechat",
      title: "AI 项目到底赚不赚钱？先算一次成功交付的成本",
      body: "![x](待替换-公众号配图-1)\n\n旧文",
    },
    {
      id: "b",
      platform: "xiaohongshu",
      title: "AI 项目到底赚不赚钱？",
      body: "短文",
    },
  ] as ContentItem[];

  const result = applyDraftOverlayToItems(items, overlay, overlayBody);
  assert.equal(result.applied, true);
  assert.equal(result.items[0]?.body, overlayBody);
  assert.equal(result.items[1]?.body, "短文");
});
