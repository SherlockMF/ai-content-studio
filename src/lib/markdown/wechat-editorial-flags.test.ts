import assert from "node:assert/strict";
import test from "node:test";
import {
  collectWechatEditorialFlags,
  mergeEditorialFlagsIntoReview,
} from "./wechat-editorial-flags";

const VALID_TABLE = `| 收费方式 | 客户主要买什么 |
| --- | --- |
| 账号或用量 | 使用软件的能力 |
| 结果计费 | 可归因的业务结果 |`;

test("独立成行的 [来源](url) 报 orphan-source-link", () => {
  const body = `Stripe 介绍了结果计费。

[来源](https://stripe.com/resources/more/outcome-based-pricing)

对于招聘助手，筛出候选人后还有面试。`;
  const flags = collectWechatEditorialFlags(body);
  assert.ok(flags.some((f) => f.id === "orphan-source-link" && f.severity === "high"));
});

test("段内内联 [来源](url) 不报 orphan-source-link", () => {
  const body =
    "Stripe 对结果计费的介绍把计费单位列为关键条件。[来源](https://stripe.com/x)\n\n下一段。";
  const flags = collectWechatEditorialFlags(body);
  assert.equal(
    flags.some((f) => f.id === "orphan-source-link"),
    false
  );
});

test("图后单独一行 [来源](url) 报 orphan-source-link", () => {
  const body = `账单可能算不一致。

![归因示意](/article-assets/a.png)

[来源](https://stripe.com/x)

对于招聘助手。`;
  assert.ok(
    collectWechatEditorialFlags(body).some((f) => f.id === "orphan-source-link")
  );
});

test("换行被压扁的表报 broken-markdown-table", () => {
  const body =
    "差别就清楚了。 | 收费方式 | 客户主要买什么 | | --- | --- | | 账号或用量 | 使用软件的能力 | 也可以组合。";
  const flags = collectWechatEditorialFlags(body);
  assert.ok(flags.some((f) => f.id === "broken-markdown-table" && f.severity === "high"));
  assert.equal(
    flags.some((f) => f.id === "table-preview-reminder"),
    false
  );
});

test("正常 Markdown 表报 table-preview-reminder", () => {
  const body = `差别就清楚了。\n\n${VALID_TABLE}\n\n也可以组合。`;
  const flags = collectWechatEditorialFlags(body);
  assert.ok(
    flags.some((f) => f.id === "table-preview-reminder" && f.severity === "medium")
  );
  assert.equal(
    flags.some((f) => f.id === "broken-markdown-table"),
    false
  );
});

test("无表无悬空来源时为空", () => {
  assert.deepEqual(
    collectWechatEditorialFlags("一段普通正文，没有表格也没有引用链接。"),
    []
  );
});

test("merge 去重同 dimension，并保留模型原 issues", () => {
  const review = {
    score: 88,
    issues: [
      {
        dimension: "结构可读",
        severity: "low" as const,
        suggestion: "段落可再短一点",
      },
      {
        dimension: "orphan-source-link",
        severity: "medium" as const,
        suggestion: "模型已提过来源",
      },
    ],
  };
  const flags = collectWechatEditorialFlags(`x\n\n[来源](https://a.com)\n\ny`);
  const merged = mergeEditorialFlagsIntoReview(review, flags);
  assert.equal(
    merged.issues.filter((i) => i.dimension === "orphan-source-link").length,
    1
  );
  assert.ok(merged.issues.some((i) => i.dimension === "结构可读"));
  assert.equal(merged.score, 88);
});
