# Qwen-Image 3.0 一键生图接入设计

## 目标

在现有「只生成提示词 → 人工去 ChatGPT 生图」流程上，接入阿里云 DashScope 的 **Qwen-Image 3.0**，支持：

1. 设置页本机配置生图 API Key（localStorage，不进 Supabase）
2. 封面 / 正文配图弹窗一键生图
3. 生成结果写入本地 `article-assets`，可直接插入稿件

文本模型仍走 DeepSeek；生图与文本 Key **分离**。

## 非目标（首版）

- 小红书批量自动生图
- 图生图 / 多参考图编辑（可预留接口字段，UI 不做）
- 计费看板、用量统计
- SiliconFlow 等其它网关（后续可加，首版只做 DashScope）

## 模型与 API

| 项 | 选择 |
|---|---|
| 平台 | 阿里云 DashScope（百炼 / Model Studio） |
| 默认模型 | `qwen-image-3.0`（更快、成本更低） |
| 可选模型 | `qwen-image-3.0-pro`（复杂排版、小字更稳） |
| 默认 Base URL | `https://dashscope.aliyuncs.com`（国内）；国际站可改为 `https://dashscope-intl.aliyuncs.com` |
| 调用 | `POST /api/v1/services/aigc/multimodal-generation/generation` |
| 鉴权 | `Authorization: Bearer <DASHSCOPE_API_KEY>` |

请求体要点（以官方 multimodal-generation 为准）：

- `model`: `qwen-image-3.0` / `qwen-image-3.0-pro`
- `input.messages[0].content[].text`: 生图提示词（沿用现有中文 `gptPrompt`）
- `parameters.size`: `宽*高`，总像素在 512×512～2048×2048
- 封面默认尺寸：`1472*624`（约 2.35:1）；正文配图默认：`1280*720`（16:9）
- `parameters.n`: 1（首版每次一张）
- `parameters.watermark`: `false`

响应：解析返回的图片 URL 或 base64，下载后走现有 `getAssetStore().put` / `/api/upload/article-image` 同源存储。

## 设置与凭证

新增 `ImageGenSettings`（与 `LLMClientSettings` 并列）：

- `provider`: `"dashscope"`
- `model`: `"qwen-image-3.0"` | `"qwen-image-3.0-pro"`
- `apiKey`: string
- `baseUrl`: string（默认国内 dashscope）

存储：

- 浏览器：`localStorage` key 如 `ai-content-image-settings-v1`
- 服务端优先：`.env.local` 的 `DASHSCOPE_API_KEY`（或 `IMAGE_API_KEY`）
- 与 LLM 相同规则：服务端 env 有 Key 时优先；否则用请求体带来的本机 Key
- Base URL 白名单：`dashscope.aliyuncs.com`、`dashscope-intl.aliyuncs.com`，以及 `IMAGE_ALLOWED_BASE_URLS`

设置页新增卡片「生图模型」：模型下拉、Base URL、Key（显隐）、保存按钮。说明文案写明仅本机、不进云端快照。

## 服务端接口

`POST /api/ai/image/generate`

请求：

```ts
{
  prompt: string;
  purpose: "cover" | "illustration";
  size?: string; // "1472*624"
  model?: "qwen-image-3.0" | "qwen-image-3.0-pro";
  image?: Partial<ImageGenSettings>; // 本机 Key/URL，结构同 LLM 的 withLLMPayload
}
```

响应：

```ts
{
  url: string;       // /article-assets/...
  fileName: string;
  contentHash?: string;
  revisedPrompt?: string; // 若平台返回扩写提示则透传，可空
}
```

失败：401/缺 Key、平台错误信息原样或简短中文提示。

## 前端交互

### 封面弹窗 `CoverSuggestionsDialog`

每套方案保留：复制提示词、按建议优化。

新增：

- 「用 Qwen 生图」：调用 `/api/ai/image/generate`（`purpose: cover`）
- 生成中按钮 loading；成功后卡片内缩略图预览
- 「用作封面」：把图片 URL 交给现有封面插入逻辑（与本地上传封面同一路径）
- 「下载」：可选

无 Key 时 toast：引导去设置页填写 DashScope Key。

### 配图弹窗 `IllustrationSuggestionsDialog`

同样增加「用 Qwen 生图」→ 预览 →「插入占位位置」（替换 `待替换-上传图片后填链接`）。

### 文案调整

弹窗说明从「只能复制到 ChatGPT」改为「可一键用 Qwen-Image 3.0 生图，也可继续复制提示词」。

## 数据流

```
提示词 gptPrompt
  → POST /api/ai/image/generate (+ 本机 image settings)
  → DashScope multimodal-generation
  → 下载图片 bytes
  → AssetStore.put → /article-assets/xxx.png
  → UI 预览 / 写入正文或封面
```

## 安全

- Key 不写 Supabase、不进版本历史正文
- 服务端校验 Base URL 白名单（防 SSRF）
- 图片 MIME / 大小沿用现有上传限制（≤8MB，jpg/png/webp/gif）

## 测试

- `normalizeImageGenSettings` / load-save roundtrip
- generate handler：缺 Key → 4xx；mock DashScope 成功路径写入 store（可注入 fetch）
- 尺寸映射：cover → `1472*624`，illustration → `1280*720`

## 验收

1. 设置页保存 DashScope Key 后刷新仍在
2. 封面弹窗一键生图出现预览，可写入稿件封面位
3. 配图弹窗一键生图可替换正文占位
4. 未配 Key 时有明确引导，不静默失败
5. DeepSeek 文本链路不受影响

## 开放决定（已拍板）

- 范围：A（设置 + 一键生图插入）
- 平台：DashScope
- 默认模型：`qwen-image-3.0`（设置里可选 pro）
