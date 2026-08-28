import fs from "fs";

const path = "src/lib/seed/articles.ts";
const content = fs.readFileSync(path, "utf8");
const marker = "export const ARTICLE_HARNESS";
const idx = content.indexOf(marker);
if (idx === -1) throw new Error("ARTICLE_HARNESS not found");

const head = `/** 种子稿：今天 Parvis 盲测；下周五 Harness */

export { ARTICLE_PARVIS_BLINDTEST as ARTICLE_GIS } from "./parvis-blindtest-article";

`;

fs.writeFileSync(path, head + content.slice(idx), "utf8");
console.log("Updated", path);
