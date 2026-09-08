import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCoverContextHints,
  enforceCoverAspectRatio,
  isHarnessArticleCover,
  isParvisBlindtestCover,
} from "@/lib/illustrations/cover-prompt-style";

test("enforceCoverAspectRatio rewrites 16:9 body-illustration ratio", () => {
  const fixed = enforceCoverAspectRatio(
    "简约扁平信息图，16:9，浅色背景，微信公众号配图。中央大标题。"
  );
  assert.match(fixed, /2\.35:1/);
  assert.doesNotMatch(fixed, /16:9/);
});

test("enforceCoverAspectRatio prepends cover ratio when missing", () => {
  const fixed = enforceCoverAspectRatio("中央写 Agent = Model + Harness，浅色背景。");
  assert.match(fixed, /2\.35:1/);
  assert.match(fixed, /1472×624/);
});

test("isHarnessArticleCover matches Harness 观点稿", () => {
  assert.equal(
    isHarnessArticleCover({
      title: "模型越来越强，Agent 为什么还是干不完活？我开始理解 Harness 了",
      digest: "Model 决定上限，Harness 决定兑现率",
    }),
    true
  );
  assert.equal(
    isHarnessArticleCover({
      title: "DeepSeek Harness 让我重新理解了 Agent",
      body: "Agent = Model + Harness。Everything is a Plugin。",
    }),
    true
  );
  assert.equal(
    isHarnessArticleCover({
      title: "Parvis 盲测：会算也会做 GIS",
      body: "城市规划 Agent 盲测",
    }),
    false
  );
});

test("buildCoverContextHints for Harness emphasizes 上限与兑现率", () => {
  const hints = buildCoverContextHints({
    title: "模型越来越强，Agent 为什么还是干不完活？我开始理解 Harness 了",
    digest: "Model 决定上限，Harness 决定兑现率",
    body: "Agent = Model + Harness。Model 决定能力上限，Harness 决定能力兑现率。",
  });
  assert.match(hints, /上限/);
  assert.match(hints, /兑现率/);
  assert.match(hints, /Model \+ Harness|Agent = Model/);
  assert.equal(isParvisBlindtestCover({ title: hints }), false);
});
