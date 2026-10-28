/**
 * 重跑 Parvis 盲测稿的小红书文案 + 配图（图标按官方对比图形态）
 * 用法：
 *   npx tsx scripts/generate-xiaohongshu-blindtest.ts
 *   npx tsx scripts/generate-xiaohongshu-blindtest.ts --resume
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DEMO_PUBLISH_VOICE } from "../src/lib/mock-data";
import { generateXiaohongshuArticle } from "../src/lib/ai/generators";
import { generateDashScopeImage } from "../src/lib/ai/image/dashscope-image";
import { IMAGE_SIZE_BY_PURPOSE } from "../src/lib/ai/image-settings";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "../src/lib/xiaohongshu/visual-rules";
import { PARVIS_BLINDTEST_SUPPLEMENTARY_NOTES } from "../src/lib/content-supplementary-notes";
import { buildXiaohongshuRenderPrompt } from "../src/lib/xiaohongshu/generate-images";
import { ARTICLE_PARVIS_BLINDTEST } from "../src/lib/seed/parvis-blindtest-article";
import type { XiaohongshuGenerationResult, XiaohongshuImagePrompt } from "../src/types/domain";

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

async function exists(filePath: string) {
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
  const model = (process.env.DASHSCOPE_IMAGE_MODEL || "qwen-image-3.0").trim() as
    | "wanx-v1"
    | "qwen-image-3.0"
    | "qwen-image-3.0-pro";

  if (!dashscopeKey) throw new Error("缺少 DASHSCOPE_API_KEY");

  const outDir = path.join(root, "output", "xiaohongshu-blindtest");
  await mkdir(outDir, { recursive: true });
  const draftPath = path.join(outDir, "xiaohongshu-draft.json");

  console.log(`Image model: ${model}`);
  if (model !== "qwen-image-3.0" && model !== "qwen-image-3.0-pro") {
    throw new Error(
      `拒绝使用 ${model}：盲测配图必须用 qwen-image（禁止 wanx 抽象风）。请在 .env.local 设 DASHSCOPE_IMAGE_MODEL=qwen-image-3.0，并在百炼关闭「免费额度用完即停」。`
    );
  }

  let result: XiaohongshuGenerationResult;
  if (resume && (await exists(draftPath))) {
    console.log("断点续跑：读取已有 draft");
    result = JSON.parse(await readFile(draftPath, "utf8")) as XiaohongshuGenerationResult;
  } else {
    if (!deepseekKey) throw new Error("缺少 DEEPSEEK_API_KEY");
    console.log("转换盲测稿小红书…");
    result = await generateXiaohongshuArticle({
      voice: DEMO_PUBLISH_VOICE,
      sourceContent: {
        id: "parvis-blindtest",
        title: ARTICLE_PARVIS_BLINDTEST.title,
        digest: ARTICLE_PARVIS_BLINDTEST.digest,
        body: ARTICLE_PARVIS_BLINDTEST.body,
        cta: "你怎么看？评论区聊聊你的判断。",
        supplementaryNotes: PARVIS_BLINDTEST_SUPPLEMENTARY_NOTES,
      },
    });
    await writeFile(
      draftPath,
      JSON.stringify(
        { ...result, visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION },
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
  const negativePrompt =
    "abstract art, geometric collage, stationery mockup, notebook photo, business card stack, lifestyle product photo, no readable text, scribbles instead of chinese characters, coke can, beverage, neon cyberpunk, particle effects, blurry text, watermark";

  const imagePlan: XiaohongshuImagePrompt[] = [];
  for (const image of result.imagePlan) {
    const fileName = `${String(image.index).padStart(2, "0")}-${image.role}.png`;
    const filePath = path.join(outDir, fileName);
    if (await exists(filePath)) {
      console.log(`跳过已有 ${fileName}`);
      imagePlan.push({ ...image, imageUrl: fileName, imageError: undefined });
      continue;
    }

    console.log(`生图 ${image.index}/${result.imagePlan.length} · ${image.overlayText.slice(0, 40)}`);
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const prompt = buildXiaohongshuRenderPrompt(
          image,
          result.visualDirection || XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
          { forceBlindtestIcons: true }
        );
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
        if (!imageRes.ok) throw new Error(`下载图 ${image.index} 失败`);
        await writeFile(filePath, Buffer.from(await imageRes.arrayBuffer()));
        imagePlan.push({ ...image, imageUrl: fileName, imageError: undefined });
        console.log(`  ✓ ${fileName}`);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        console.warn(
          `  重试 ${attempt}/3：${error instanceof Error ? error.message : error}`
        );
      }
    }
    if (lastError) throw lastError;

    await writeFile(
      draftPath,
      JSON.stringify(
        {
          ...result,
          visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
          imagePlan: [
            ...imagePlan,
            ...result.imagePlan
              .slice(imagePlan.length)
              .map((item) => ({ ...item, imageUrl: undefined })),
          ],
        },
        null,
        2
      ),
      "utf8"
    );
  }

  await writeFile(
    draftPath,
    JSON.stringify(
      {
        ...result,
        visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
        imagePlan,
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
