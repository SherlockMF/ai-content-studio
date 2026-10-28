import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { POST as postTopics } from "./topics/route";
import { POST as postDirections } from "./research-directions/route";
import { POST as postWechat } from "./wechat/route";
import { POST as postReview } from "./review/route";
import { POST as postCover } from "./cover/route";
import { POST as postIllustrations } from "./illustrations/route";
import { POST as postRewrite } from "./rewrite/route";

const llm = { apiKey: "test-key" };
const ARTICLE_BODY = "第一段讲清楚问题背景和结论。\n\n第二段给出三个具体数字：12%、30 分钟、5 个团队。\n\n第三段是落地建议和行动清单。";

type Responder = (task: string, messages: { role: string; content: string }[]) => unknown;

function mockDeepSeek(t: TestContext, respond: Responder) {
  const tasks: string[] = [];
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const { messages } = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
    const joined = messages.map((message) => message.content).join("\n");
    const task = joined.includes("选题去重审核员")
      ? "dedupe"
      : [...joined.matchAll(/Task: (\w+)/g)].at(-1)?.[1] ?? "unknown";
    tasks.push(task);
    const payload = respond(task, messages);
    if (payload instanceof Error) return new Response(payload.message, { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
  });
  return { tasks, fetchMock };
}

function post(handler: (request: Request) => Promise<Response>, body: unknown) {
  return handler(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
}

const topic = (title: string) => ({
  title, coreViewpoint: `${title}的观点`, targetAudience: "管理者", painPoint: "痛点", section: "AI 通识",
  platform: ["wechat"], contentGoal: "建立专业信任", recommendedFormat: "长文", openingHook: "开场",
});

const direction = (title: string) => ({
  title, angle: "切口", whyNow: "为什么现在", targetAudience: "管理者", outline: ["一", "二", "三", "四"],
  coreViewpoint: "观点", section: "AI 通识", openingHook: "开场",
});

const coverPayload = {
  summary: "封面策略",
  variants: [{ id: "1", styleLabel: "概念插画", overlayText: "短文案", gptPrompt: "微信公众号头条封面图，比例 2.35:1，画面...", altText: "公众号封面" }],
};

const illustrationPayload = {
  summary: "配图策略",
  suggestions: [
    { id: "1", placementLabel: "第一段后", anchorSnippet: "第一段讲清楚问题背景和结论。", reason: "引入", imageKind: "概念插图", gptPrompt: "提示词1" },
    { id: "2", placementLabel: "第二段后", anchorSnippet: "第二段给出三个具体数字：12%、30 分钟、5 个团队。", reason: "数据", imageKind: "数据图表", gptPrompt: "提示词2" },
    { id: "3", placementLabel: "第三段后", anchorSnippet: "第三段是落地建议和行动清单。", reason: "总结", imageKind: "流程示意图", gptPrompt: "提示词3" },
  ],
};

test("topics: rejects malformed published history without calling the model", async (t) => {
  const { fetchMock } = mockDeepSeek(t, () => ({}));
  const response = await post(postTopics, { publishedArticles: [{ title: "缺少 id" }], llm });
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("topics: generates topics and removes exact duplicates of published articles", async (t) => {
  const { tasks } = mockDeepSeek(t, (task) => {
    if (task === "generateTopics") return { topics: [topic("新选题"), topic("已发布标题")] };
    if (task === "dedupe") return { checks: [{ index: 0, duplicateOf: null, reason: "新角度" }, { index: 1, duplicateOf: null, reason: "新角度" }] };
    throw new Error(`unexpected task ${task}`);
  });
  const response = await post(postTopics, {
    count: 2,
    publishedArticles: [{ id: "p1", title: "已发布标题", coreViewpoint: "旧观点", body: "旧正文" }],
    llm,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.topics.map((item: { title: string }) => item.title), ["新选题"]);
  assert.equal(result.deduplication.removed.length, 1);
  assert.deepEqual(tasks, ["generateTopics", "dedupe"]);
});

test("research-directions: requires a hotspot", async (t) => {
  const { fetchMock } = mockDeepSeek(t, () => ({}));
  const response = await post(postDirections, { llm });
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("research-directions: returns leverage angle and directions", async (t) => {
  mockDeepSeek(t, (task) => {
    assert.equal(task, "generateResearchDirections");
    return { leverageAngle: "借势角度", directions: [direction("A"), direction("B"), direction("C")] };
  });
  const response = await post(postDirections, { hotspot: { id: "h1", title: "热点", url: "https://example.com" }, llm });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.leverageAngle, "借势角度");
  assert.equal(result.directions.length, 3);
});

const wechatTopic = { id: "topic_1", ...topic("公众号选题") };

test("wechat: requires a topic", async (t) => {
  const { fetchMock } = mockDeepSeek(t, () => ({}));
  const response = await post(postWechat, { mode: "from_scratch", llm });
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("wechat: from_scratch generates, de-AI rewrites, then plans cover and illustrations", async (t) => {
  const { tasks } = mockDeepSeek(t, (task) => {
    if (task === "generateWechatArticle") return { title: "生成标题", digest: "摘要", coverCopy: "", body: "初稿正文", cta: "关注" };
    if (task === "deAiRewrite") return { body: ARTICLE_BODY, notes: "已润色" };
    if (task === "suggestIllustrations") return illustrationPayload;
    if (task === "suggestCoverImages") return coverPayload;
    throw new Error(`unexpected task ${task}`);
  });
  const response = await post(postWechat, { mode: "from_scratch", topic: wechatTopic, llm });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.title, "生成标题");
  assert.ok(result.body.includes("第二段给出三个具体数字"));
  assert.equal(result.illustrationInserted, 3);
  assert.equal(result.coverVariants.length, 1);
  assert.equal(result.coverCopy, "短文案");
  assert.deepEqual(tasks.slice(0, 2), ["generateWechatArticle", "deAiRewrite"]);
  assert.deepEqual([...tasks.slice(2)].sort(), ["suggestCoverImages", "suggestIllustrations"]);
});

test("wechat: polish keeps existing meta and only rewrites the body", async (t) => {
  const { tasks } = mockDeepSeek(t, (task) => {
    assert.equal(task, "deAiRewrite");
    return { body: ARTICLE_BODY, notes: "已润色" };
  });
  const response = await post(postWechat, {
    mode: "polish",
    topic: wechatTopic,
    existingBody: ARTICLE_BODY,
    existingMeta: { title: "原标题", digest: "原摘要", coverCopy: "原封面", cta: "原CTA" },
    llm,
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.title, "原标题");
  assert.equal(result.digest, "原摘要");
  assert.equal(result.body, ARTICLE_BODY);
  assert.ok(result.factDiff);
  assert.deepEqual(tasks, ["deAiRewrite"]);
});

test("wechat: surfaces provider failures as 500 with a message", async (t) => {
  mockDeepSeek(t, () => new Error("upstream down"));
  const response = await post(postWechat, { mode: "from_scratch", topic: wechatTopic, llm });
  assert.equal(response.status, 500);
  assert.match((await response.json()).message, /DeepSeek/);
});

test("review: wechat review returns score and issues", async (t) => {
  mockDeepSeek(t, (task) => {
    assert.equal(task, "reviewContent");
    return { score: 88, issues: [{ dimension: "结构", severity: "low", suggestion: "精简" }] };
  });
  const response = await post(postReview, { title: "标题", body: ARTICLE_BODY, targetAudience: "管理者", llm });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.score, 88);
  assert.ok(Array.isArray(result.issues));
});

test("review: xiaohongshu platform uses the xiaohongshu reviewer", async (t) => {
  let sawXiaohongshu = false;
  mockDeepSeek(t, (_task, messages) => {
    sawXiaohongshu = messages.some((message) => message.content.includes("小红书"));
    return { score: 70, issues: [] };
  });
  const response = await post(postReview, { platform: "xiaohongshu", title: "标题", body: "正文", llm });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).score, 70);
  assert.ok(sawXiaohongshu);
});

test("cover: requires title or body", async (t) => {
  const { fetchMock } = mockDeepSeek(t, () => ({}));
  const response = await post(postCover, { llm });
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("cover: returns exactly one variant from the model", async (t) => {
  mockDeepSeek(t, () => ({ ...coverPayload, variants: [...coverPayload.variants, ...coverPayload.variants] }));
  const response = await post(postCover, { title: "标题", body: ARTICLE_BODY, llm });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.variants.length, 1);
  assert.match(result.variants[0].gptPrompt, /2\.35:1/);
});

test("cover: falls back to heuristic suggestions when the model fails", async (t) => {
  mockDeepSeek(t, () => new Error("upstream down"));
  const response = await post(postCover, { title: "标题", body: ARTICLE_BODY, llm });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).variants.length >= 1);
});

test("illustrations: requires a body", async (t) => {
  const { fetchMock } = mockDeepSeek(t, () => ({}));
  const response = await post(postIllustrations, { title: "标题", llm });
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("illustrations: returns normalized suggestions and falls back on failure", async (t) => {
  mockDeepSeek(t, () => illustrationPayload);
  const ok = await post(postIllustrations, { title: "标题", body: ARTICLE_BODY, llm });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).suggestions.length, 3);

  t.mock.restoreAll();
  mockDeepSeek(t, () => new Error("upstream down"));
  const fallback = await post(postIllustrations, { title: "标题", body: ARTICLE_BODY, llm });
  assert.equal(fallback.status, 200);
  assert.ok(Array.isArray((await fallback.json()).suggestions));
});

test("rewrite: requires original text", async (t) => {
  const { fetchMock } = mockDeepSeek(t, () => ({}));
  const response = await post(postRewrite, { llm });
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("rewrite: returns candidate and skill sources", async (t) => {
  mockDeepSeek(t, () => ({ body: "改写后正文", notes: "说明" }));
  const response = await post(postRewrite, { original: "原始正文", title: "标题", llm });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.candidate, "改写后正文");
  assert.ok(Array.isArray(result.skills));
});
