import fs from "fs";
import path from "path";

const src = process.argv[2];
const out = path.resolve("src/lib/seed/parvis-blindtest-article.ts");

const md = fs.readFileSync(src, "utf8");
const lines = md.split(/\r?\n/);
const title = lines[0].replace(/^#\s*/, "").trim();
const body = lines.slice(2).join("\n").trim();

const article = {
  title,
  digest:
    "同一套城市更新项目资料，对 Parvis、Codex、Cola、WorkBuddy 做两轮城市规划 Agent 盲测。Parvis 会算也会做 GIS，但开放任务下的自主编排仍是短板。",
  coverCopy: "盲测之后，谁更像规划生产 Agent",
  section: "行业观察",
  coreViewpoint:
    "Parvis 并不是不会做规划，而是不告诉它该做什么时，不能稳定调用已有专业能力。",
  painPoint: "工具能力很强，Agent 自主编排明显不足。",
  openingHook: "最近我用同一套城市更新项目资料，对几类 AI Agent 做了一轮城市规划能力测试。",
  body,
};

const content = `/** Parvis 盲测稿（今天发布） */\n\nexport const ARTICLE_PARVIS_BLINDTEST = ${JSON.stringify(article, null, 2)} as const;\n`;
fs.writeFileSync(out, content, "utf8");
console.log(`Wrote ${out} (body ${body.length} chars)`);
