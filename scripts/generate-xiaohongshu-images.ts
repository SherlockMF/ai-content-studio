/**
 * 本地脚本：公众号 → 小红书文案/图规划 → wanx-v1 批量生图
 * 用法：
 *   npx tsx scripts/generate-xiaohongshu-images.ts
 *   npx tsx scripts/generate-xiaohongshu-images.ts --resume
 * 凭证：.env.local 的 DEEPSEEK_API_KEY + DASHSCOPE_API_KEY
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEMO_PUBLISH_VOICE } from "../src/lib/mock-data";
import { generateXiaohongshuArticle } from "../src/lib/ai/generators";
import { generateDashScopeImage } from "../src/lib/ai/image/dashscope-image";
import { IMAGE_SIZE_BY_PURPOSE } from "../src/lib/ai/image-settings";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "../src/lib/ai/xiaohongshu-prompt";
import type { XiaohongshuGenerationResult } from "../src/types/domain";

async function loadEnvLocal(root: string) {
  const envPath = path.join(root, ".env.local");
  try {
    const text = await readFile(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function maskKey(key: string) {
  if (key.length < 10) return "***";
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const root = process.cwd();
  await loadEnvLocal(root);
  const resume = process.argv.includes("--resume");

  const dashscopeKey = (process.env.DASHSCOPE_API_KEY || "").trim();
  const deepseekKey = (process.env.DEEPSEEK_API_KEY || "").trim();
  const baseUrl =
    (process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com").trim();
  const model = (process.env.DASHSCOPE_IMAGE_MODEL || "wanx-v1").trim() as
    | "wanx-v1"
    | "qwen-image-3.0"
    | "qwen-image-3.0-pro";

  if (!dashscopeKey) {
    throw new Error("缺少 DASHSCOPE_API_KEY");
  }

  console.log(`DashScope Key: ${maskKey(dashscopeKey)}`);
  console.log(`Image model: ${model}`);

  const outDir = path.join(root, "output", "xiaohongshu-harness");
  await mkdir(outDir, { recursive: true });
  const draftPath = path.join(outDir, "xiaohongshu-draft.json");

  let result: XiaohongshuGenerationResult;
  if (resume && (await fileExists(draftPath))) {
    console.log("断点续跑：读取已有 xiaohongshu-draft.json");
    result = JSON.parse(await readFile(draftPath, "utf8")) as XiaohongshuGenerationResult;
  } else {
    if (!deepseekKey) {
      throw new Error("缺少 DEEPSEEK_API_KEY（需要先转小红书拿 imagePlan）");
    }
    const articlePath = path.join(root, "output", "harness-article.md");
    const article = await readFile(articlePath, "utf8");
    const titleMatch = article.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() || "Harness 小红书";
    const body = article.replace(/^#\s+.+\n+/, "").trim();

    console.log("正在转换小红书文案与图片规划…");
    result = await generateXiaohongshuArticle({
      voice: DEMO_PUBLISH_VOICE,
      sourceContent: {
        id: "harness-local",
        title,
        digest: "Model 决定上限，Harness 决定兑现率",
        body,
        cta: "你怎么看？",
      },
    });

    await writeFile(
      draftPath,
      JSON.stringify(
        {
          ...result,
          visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(outDir, "professional.md"),
      [
        `# ${result.variants.professional.title}`,
        "",
        result.variants.professional.body,
        "",
        result.variants.professional.cta,
        "",
        result.variants.professional.hashtags.map((t) => `#${t}`).join(" "),
      ].join("\n"),
      "utf8"
    );
  }

  const size = IMAGE_SIZE_BY_PURPOSE.xiaohongshu;
  const generated: Array<{
    index: number;
    role: string;
    overlayText: string;
    file: string;
    url: string;
  }> = [];

  const manifestPath = path.join(outDir, "generated-manifest.json");
  if (await fileExists(manifestPath)) {
    try {
      const prev = JSON.parse(await readFile(manifestPath, "utf8")) as {
        generated?: typeof generated;
      };
      if (Array.isArray(prev.generated)) generated.push(...prev.generated);
    } catch {
      // ignore
    }
  }

  for (const image of result.imagePlan) {
    const fileName = `${String(image.index).padStart(2, "0")}-${image.role}.png`;
    const filePath = path.join(outDir, fileName);
    if (await fileExists(filePath)) {
      console.log(`跳过已有 ${fileName}`);
      if (!generated.some((item) => item.index === image.index)) {
        generated.push({
          index: image.index,
          role: image.role,
          overlayText: image.overlayText,
          file: fileName,
          url: "",
        });
      }
      continue;
    }

    console.log(
      `生图 ${image.index}/${result.imagePlan.length} · ${image.role} · ${image.overlayText}`
    );
    const prompt = [
      XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
      image.prompt.replace(/Everything is a Plugin/gi, "插件化拼装"),
      `必须把这些中文大字清楚写在画面上（占画面主要阅读区）：${image.overlayText.replace(/Everything is a Plugin/gi, "插件化拼装")}`,
      "风格硬性要求：像小红书干货讲解幻灯片 / 产品功能介绍卡；扁平信息图 + 圆角卡片 + 小图标 + 可读中文标题；暖米白底。",
      "严禁：抽象 3D 雕塑、空洞几何漂浮、无文字壁纸、科幻光效、纯氛围装饰、看不清字。",
      "竖版约 3:4，安全边距，手机滑动笔记多图第 N 页观感。",
    ].join("\n");

    const negativePrompt =
      "抽象艺术, 3D雕塑, 无文字, 科技霓虹, 赛博朋克, 粒子特效, 模糊文字, 乱码, 水印, 低清晰度";

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const { imageUrl } = await generateDashScopeImage({
          apiKey: dashscopeKey,
          baseUrl,
          model,
          prompt,
          size,
          negativePrompt,
          pollIntervalMs: 3000,
          maxPollAttempts: 90,
        });

        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
          throw new Error(`下载图 ${image.index} 失败 HTTP ${imageRes.status}`);
        }
        const bytes = Buffer.from(await imageRes.arrayBuffer());
        await writeFile(filePath, bytes);
        generated.push({
          index: image.index,
          role: image.role,
          overlayText: image.overlayText,
          file: fileName,
          url: imageUrl,
        });
        await writeFile(
          manifestPath,
          JSON.stringify(
            {
              model,
              size,
              visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
              generated,
            },
            null,
            2
          ),
          "utf8"
        );
        console.log(`  ✓ 已保存 ${fileName}`);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        console.warn(
          `  重试 ${attempt}/3 失败：${error instanceof Error ? error.message : error}`
        );
      }
    }
    if (lastError) throw lastError;
  }

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        model,
        size,
        visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
        generated,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`完成：${outDir}`);
}

const isDirectRun = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
