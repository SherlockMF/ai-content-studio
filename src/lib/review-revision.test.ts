import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReviewEdits,
  reviewRevisionSignature,
  selectedReviewIssues,
  type ReviewRevisionDraft,
} from "./review-revision";

const draft: ReviewRevisionDraft = {
  platform: "xiaohongshu", title: "员工会用AI，公司就转型了吗", body: "保留正文与数字 42。",
  imagePlan: [{ index: 1, role: "cover", objective: "说明转型", overlayText: "旧标题", composition: "左右布局", prompt: "旧提示词", imageUrl: "/old.png" }],
};
const issues = [
  { dimension: "标题", severity: "high" as const, suggestion: "补全标题" },
  { dimension: "正文", severity: "medium" as const, suggestion: "缩短正文" },
];

test("只传递勾选问题，过滤越界和重复索引", () => {
  assert.deepEqual(selectedReviewIssues(issues, [0, 0, 99, -1]), [issues[0]]);
});

test("标题定点修正保留正文和图片，输入不被修改", () => {
  const original = structuredClone(draft);
  const result = applyReviewEdits(draft, [{ issueIndex: 0, field: "title", before: draft.title, after: "员工会用AI≠公司完成AI转型" }], 1);
  assert.equal(result.draft.title, "员工会用AI≠公司完成AI转型");
  assert.equal(result.draft.body, draft.body);
  assert.deepEqual(result.draft.imagePlan, draft.imagePlan);
  assert.deepEqual(draft, original);
});

test("拒绝未选问题及无法唯一定位的替换，整次修改不落地", () => {
  assert.throws(() => applyReviewEdits(draft, [{ issueIndex: 1, field: "title", before: draft.title, after: "新标题" }], 1), /条目/);
  assert.throws(() => applyReviewEdits({ ...draft, body: "重复重复" }, [{ issueIndex: 0, field: "body", before: "重复", after: "修改" }], 1), /唯一/);
  const original = structuredClone(draft);
  assert.throws(() => applyReviewEdits(draft, [
    { issueIndex: 0, field: "title", before: draft.title, after: "新标题" },
    { issueIndex: 0, field: "body", before: "不存在", after: "修改" },
  ], 1), /定位/);
  assert.deepEqual(draft, original);
});

test("修正图文方案只使对应旧图失效", () => {
  const result = applyReviewEdits(draft, [{ issueIndex: 0, field: "overlayText", imageIndex: 1, before: "旧标题", after: "新标题" }], 1);
  assert.equal(result.draft.imagePlan?.[0].imageUrl, undefined);
  assert.equal(result.changedImages, 1);
  assert.equal(draft.imagePlan?.[0].imageUrl, "/old.png");
});

test("拒绝超长小红书标题，不自动截断", () => {
  assert.throws(() => applyReviewEdits(draft, [{ issueIndex: 0, field: "title", before: draft.title, after: "长".repeat(21) }], 1), /20/);
});

test("空替换仅允许原字段为空，不能意外插到非空正文开头", () => {
  assert.throws(() => applyReviewEdits(draft, [{ issueIndex: 0, field: "body", before: "", after: "新增" }], 1), /空/);
});

test("快照包含来源和平台，识别请求期间的变更", () => {
  const s = reviewRevisionSignature(draft, "来源 A");
  assert.notEqual(s, reviewRevisionSignature(draft, "来源 B"));
  assert.notEqual(s, reviewRevisionSignature({ ...draft, title: "新标题" }, "来源 A"));
  assert.equal(s, reviewRevisionSignature(structuredClone(draft), "来源 A"));
});
