import test from "node:test";
import assert from "node:assert/strict";
import { extractArticleSlots, replaceArticleSlot, stripArticlePromptText, recoverEmbeddedSlotImage } from "./article-slots";
import { extractWechatImages } from "./wechat-media";

test("识别不同提示词格式，忽略注释中的误插图片，并只替换指定图位", () => {
  const body = '![第一张](待替换-上传图片后填链接)\n\n<!-- GPT 配图提示词\n画第一张\n![误插](/article-assets/a.png)\n-->\n\n正文\n\n![第二张](待替换-上传图片后填链接)\n\n**生图提示词**：画第二张';
  const slots = extractArticleSlots(body);
  assert.equal(slots.length, 2);
  assert.match(slots[0].prompt, /画第一张/);
  assert.match(slots[1].prompt, /画第二张/);
  const result = replaceArticleSlot(body, slots[1], '/article-assets/b.png');
  assert.ok(result);
  assert.match(result, /!\[第二张\]\(\/article-assets\/b.png\)/);
  assert.match(result, /!\[第一张\]\(待替换/);
  assert.equal(replaceArticleSlot(body + '变更', slots[1], '/article-assets/b.png'), null);
});

test("图位关联多种提示词并去除完全重复的展示，不移除普通正文", () => {
  const body = '![图](待替换-上传图片后填链接)\n\n<!-- GPT 配图提示词\n画一个图\n-->\n\n**生图提示词**：画一个图\n\n正文内容。\n\n**生图提示词**：这是正文里讨论的概念';
  const slots = extractArticleSlots(body);
  assert.deepEqual(slots[0].prompts, ['画一个图']);
  const cleaned = stripArticlePromptText(body);
  assert.doesNotMatch(cleaned, /画一个图/);
  assert.match(cleaned, /正文内容/);
  assert.match(cleaned, /这是正文里讨论的概念/);
  const extracted = extractWechatImages(body);
  assert.equal(extracted.images.length, 1);
  assert.equal(extracted.images[0].prompt, '画一个图');
  assert.match(extracted.body, /正文内容/);
  assert.doesNotMatch(extracted.body, /画一个图/);
});

test("注释内单张本地图片允许明确恢复，多张或真实图位不能自动覆盖", () => {
  const body = '![图](待替换-上传图片后填链接)\n\n<!-- GPT 配图提示词\n画图\n![误插](/article-assets/a.png)\n-->';
  const slot = extractArticleSlots(body)[0];
  assert.equal(slot.embeddedImages.length, 1);
  const recovered = recoverEmbeddedSlotImage(body, slot);
  assert.ok(recovered);
  assert.match(recovered, /^!\[图\]\(\/article-assets\/a.png\)/);
  assert.doesNotMatch(recovered, /!\[误插\]/);
  assert.match(recovered, /画图/);
  assert.equal(recoverEmbeddedSlotImage(body + '修改', slot), null);
  assert.throws(() => extractWechatImages(body), /误插/);
});

test("代码块里的示例不被当作配图位", () => {
  assert.equal(extractArticleSlots('```md\n![示例](待替换)\n```\n\n![真图](待替换)').length, 1);
  assert.equal(extractArticleSlots('`![示例](待替换)`').length, 0);
  assert.equal(extractArticleSlots('![图](待替换)\n\n*提示词：旧格式*')[0].prompt, '旧格式');
});
