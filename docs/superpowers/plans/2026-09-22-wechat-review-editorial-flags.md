# 公众号质检编辑旗标 — 实现计划

**日期**：2026-09-22  
**Spec**：`docs/superpowers/specs/2026-09-22-wechat-review-editorial-flags-design.md`

## 任务

1. 新增 `collectWechatEditorialFlags` + `mergeEditorialFlagsIntoReview`（纯函数），TDD
2. 接入 `buildWechatPublishChecks`
3. 接入 `reviewContent`（合并 issues + 提示词专名/引用）
4. 更新现有 reviewers / wechat-publish 测试
5. 跑 `npm test` 相关文件

## 非目标

小红书质检、自动改稿、微信后台验证
