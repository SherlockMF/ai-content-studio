import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeImportedUrlsIntoImagePlan,
  parseLocalImageFileName,
  resolveLocalFolderHint,
} from "./import-local-images-shared";

test("parseLocalImageFileName reads index and role", () => {
  assert.deepEqual(parseLocalImageFileName("01-cover.png"), {
    index: 1,
    role: "cover",
  });
  assert.deepEqual(parseLocalImageFileName("07-ending.png"), {
    index: 7,
    role: "ending",
  });
  assert.equal(parseLocalImageFileName("readme.md"), null);
});

test("resolveLocalFolderHint picks blindtest vs harness", () => {
  assert.equal(
    resolveLocalFolderHint({ title: "Parvis 盲测：会算也会做 GIS" }),
    "xiaohongshu-blindtest"
  );
  assert.equal(
    resolveLocalFolderHint({
      title: "Agent = Model + Harness",
      body: "Model 决定上限",
    }),
    "xiaohongshu-harness"
  );
});

test("mergeImportedUrlsIntoImagePlan overlays by index", () => {
  const next = mergeImportedUrlsIntoImagePlan(
    [
      { index: 1, imageUrl: undefined, imageError: "fail" },
      { index: 2, imageUrl: undefined },
    ],
    [
      { index: 1, role: "cover", fileName: "01-cover.png", url: "/article-assets/a.png" },
    ]
  );
  assert.equal(next[0].imageUrl, "/article-assets/a.png");
  assert.equal(next[0].imageError, undefined);
  assert.equal(next[1].imageUrl, undefined);
});
