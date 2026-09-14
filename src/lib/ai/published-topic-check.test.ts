import assert from "node:assert/strict";
import test from "node:test";
import { collectPublishedArticles, checkPublishedTopics } from "./published-topic-check";
import type { ContentItem, Topic } from "@/types/domain";
import type { LLMProvider } from "./providers/types";
import { generateResearchDirections, generateTopics } from "./generators";
import { DEMO_PUBLISH_VOICE } from "@/lib/mock-data";
import { buildHarnessFromVoice } from "./build-harness";

const history = [{ id: "old", title: "AI 先掏空岗位", coreViewpoint: "任务被替代", body: "替代的是任务，而非整份工作" }];
const candidates = [
  { title: "岗位还在，任务没了", coreViewpoint: "任务被替代" },
  { title: "今年岗位变化的新调查", coreViewpoint: "有新数据和新结论" },
];
function providerFor(value: unknown): LLMProvider {
  return { async generateStructuredOutput<T>() { return value as T; }, async generateText() { throw new Error("unused"); } };
}
test("published history includes archived and previously published drafts, excludes unpublished drafts and image prompts", () => {
  const items = [
    { id: "a", topicId: "t", status: "已归档", title: "归档", body: "正文<!-- 提示词 -->![图](data:image/png;base64,abc)" },
    { id: "b", status: "编辑中", publishedAt: "2026-09-01", title: "曾发布", body: "正文" },
    { id: "c", status: "编辑中", title: "未发布", body: "正文" },
    { id: "d", status: "小红书已发布", title: "小红书", body: "正文" },
  ] as ContentItem[];
  const result = collectPublishedArticles(items, [{ id: "t", coreViewpoint: "核心" }] as Topic[]);
  assert.deepEqual(result.map(x => x.id), ["a", "b", "d"]);
  assert.equal(result[0].coreViewpoint, "核心");
  assert.equal(result[0].body, "正文");
});
test("semantic check removes paraphrased repeats and retains a substantive new angle", async () => {
  const result = await checkPublishedTopics(providerFor({ checks: [
    { index: 0, duplicateOf: "old", reason: "同一任务替代观点，换了标题" },
    { index: 1, duplicateOf: null, reason: "新增调查证据和结论" },
  ] }), candidates, history);
  assert.deepEqual(result.items, [candidates[1]]);
  assert.equal(result.deduplication.removed[0].publishedTitle, history[0].title);
});
test("exact titles are rejected even when semantic model says distinct", async () => {
  const result = await checkPublishedTopics(providerFor({ checks: [{ index: 0, duplicateOf: null, reason: "不同" }] }),
    [{ title: "AI先掏空岗位！", coreViewpoint: "其他" }], history);
  assert.equal(result.items.length, 0);
});
test("incomplete, repeated, out-of-range or unknown references fail closed", async () => {
  for (const checks of [[], [{ index: 0, duplicateOf: null, reason: "" }],
    [{ index: 0, duplicateOf: null, reason: "ok" }, { index: 0, duplicateOf: null, reason: "ok" }],
    [{ index: 0, duplicateOf: "missing", reason: "重复" }, { index: 1, duplicateOf: null, reason: "ok" }],
    [{ index: 0, duplicateOf: null, reason: "ok" }, { index: 2, duplicateOf: null, reason: "ok" }]]) {
    await assert.rejects(checkPublishedTopics(providerFor({ checks }), candidates, history));
  }
});
test("empty history skips the model; review errors propagate", async () => {
  const provider: LLMProvider = { async generateStructuredOutput() { throw new Error("review unavailable"); }, async generateText() { return ""; } };
  assert.deepEqual((await checkPublishedTopics(provider, candidates, [])).items, candidates);
  await assert.rejects(checkPublishedTopics(provider, candidates, history), /review unavailable/);
});

test("both generation entry points provide history and run a separate review before returning", async () => {
  const originalFetch = globalThis.fetch;
  const candidate = { ...candidates[0], angle: "任务", whyNow: "新热点", targetAudience: "职场人", outline: ["任务"], section: "AI 通识", openingHook: "开头", painPoint: "任务", platform: ["wechat"], contentGoal: "信任", recommendedFormat: "图文" };
  try {
    for (const mode of ["directions", "topics"] as const) {
      const calls: Array<{ messages: Array<{ content: string }> }> = [];
      globalThis.fetch = async (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        const result = calls.length === 1
          ? { [mode]: [candidate], leverageAngle: "新热点" }
          : { checks: [{ index: 0, duplicateOf: "old", reason: "只是改了标题" }] };
        return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
      };
      const common = { voice: DEMO_PUBLISH_VOICE, harness: buildHarnessFromVoice(DEMO_PUBLISH_VOICE, []), materials: [], publishedArticles: history, llm: { apiKey: "test" } };
      const result = mode === "directions"
        ? await generateResearchDirections({ ...common, hotspot: { id: "h", title: "岗位变化", url: "https://example.com" } })
        : await generateTopics({ ...common, count: 1, historyTitles: [] });
      assert.equal(calls.length, 2);
      assert.match(calls[0].messages.map(item => item.content).join("\n"), /AI 先掏空岗位/);
      assert.equal(result.deduplication.removed.length, 1);
      assert.equal("directions" in result ? result.directions.length : result.topics.length, 0);
    }
  } finally { globalThis.fetch = originalFetch; }
});
