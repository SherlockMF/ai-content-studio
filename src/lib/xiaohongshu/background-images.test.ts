import assert from "node:assert/strict";
import test from "node:test";
import { fillXiaohongshuImagePlan } from "./generate-images";
import { mergeGeneratedImage } from "./merge-generated-image";
import { createXiaohongshuContent } from "./content";
import { now, sourceItem, validResult } from "./test-fixtures";

test("逐张保存图片，一张失败仍继续生成剩余图片", async (t) => {
  let calls = 0;
  const saved: number[] = [];
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 2 ? Response.json({ message: "单张失败" }, { status: 500 })
      : Response.json({ url: `/image-${calls}.png` });
  });
  const result = await fillXiaohongshuImagePlan(validResult.imagePlan.slice(0, 3), {
    visualDirection: validResult.visualDirection,
    onImage: image => { saved.push(image.index); assert.equal(calls, saved.length); },
  });
  assert.equal(calls, 3);
  assert.deepEqual(saved, [1, 2, 3]);
  assert.equal(result[0].imageUrl, "/image-1.png");
  assert.equal(result[1].imageError, "单张失败");
  assert.equal(result[2].imageUrl, "/image-3.png");
});

test("后台结果仅写回原稿件及未改动的图片方案，保留最新文案", () => {
  const original = createXiaohongshuContent({ source: sourceItem, result: validResult, now });
  const result = { ...original.xiaohongshu!.imagePlan[0], imageUrl: "/generated.png" };
  const edited = { ...original, title: "用户改过的标题", body: "用户改过的正文" };
  const merged = mergeGeneratedImage(edited, original, result);
  assert.equal(merged.title, edited.title);
  assert.equal(merged.body, edited.body);
  assert.equal(merged.xiaohongshu!.imagePlan[0].imageUrl, result.imageUrl);
  const other = { ...edited, id: "other-article" };
  assert.equal(mergeGeneratedImage(other, original, result), other);
  const replanned = structuredClone(edited);
  replanned.xiaohongshu!.imagePlan[0].prompt = "新的图片方案";
  assert.equal(mergeGeneratedImage(replanned, original, result), replanned);
  const imported = structuredClone(edited);
  imported.xiaohongshu!.imagePlan[0].imageUrl = "/user.png";
  assert.equal(mergeGeneratedImage(imported, original, result), imported);
});
