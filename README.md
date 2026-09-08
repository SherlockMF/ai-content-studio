# AI 内容发布工作台

面向内容创作者的本地优先写作工作台，用于管理选题、资料、公众号长文和小红书图文，并通过 AI 完成研究、改写与发布前质检。

## 主要功能

- 管理选题、发布排期和内容状态。
- 根据发布人设生成或修改公众号长文。
- 导入 Markdown，管理正文配图、封面提示词和发布素材。
- 将当前公众号长文一键改编为独立的小红书稿件。
- 同时保留“小红书专业轻表达”和“强氛围版”两套可编辑文案。
- 自动规划 5～8 张 3:4 配图，并输出可直接交给 GPT 生图的提示词。
- 提供公众号与小红书发布前质检、手机预览、内容复制和 Markdown 发布包导出。
- 业务数据默认保存在浏览器本地，可选用 Supabase 同步快照。

小红书功能采用手动发布：工作台负责生成文案、话题和图片提示词，不会直接登录或操作小红书账号。

## 本地运行

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

然后访问 [http://localhost:3000](http://localhost:3000)。

## 配置模型

优先在项目根目录创建 `.env.local`（已在 `.gitignore`，不会提交）：

```dotenv
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
```

服务端会**优先使用** `.env.local` 中的 Key。未配置时，才回退到「设置 → 模型调用设置」里保存在浏览器 `localStorage` 的 Key。

如需允许自定义模型网关，可使用逗号分隔的白名单：

```dotenv
LLM_ALLOWED_BASE_URLS=https://llm.example.com,https://backup.example.com
```

修改 `.env.local` 后需重启 `npm run dev`。不要将真实密钥提交到 Git。

## 公众号转小红书

公众号首次出稿会自动生成封面和正文配图。AI 润色后，会根据旧图提示词和正文上下文检查匹配程度，保留匹配的图片，只重生成不匹配的图并补齐缺图。图片逐张保存，失败时可用“检查并补齐配图”重试；文案仍会保留。已润色的稿件在列表和编辑区显示“已 AI 润色”，记录来自本地版本历史。

1. 在“稿件”中选择一篇公众号稿件。
2. 点击“一键转小红书”。系统会读取编辑器里的当前内容，包括尚未保存的修改。
3. 在“专业轻表达”和“强氛围版”之间切换、编辑并保存。
4. 生成配图，或按图片规划复制提示词交给 GPT 生图。整组图片统一不显示页码角标；已有带角标的图片需重新生成。
5. 点击“导出发布包（ZIP）”：包含按序排列的图片文件、当前版本的标题、正文（含话题）、标签及备选文案。配图缺失或读取失败时会提示补全，不会导出残缺包。
6. 完成质检后，将图片和文案手动发布到小红书。

重新转换全文前会保留版本记录；“重新规划图片”只更新视觉方向和图片提示词，不会覆盖两版文案。

## 可选的 Supabase 同步

不配置 Supabase 时，业务数据仍可正常保存在本机浏览器。需要跨设备同步时，在 `.env.local` 中添加：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

随后可在设置页手动推送或拉取业务数据快照。模型 API Key 不会随快照同步。

## 常用命令

```bash
npm run dev       # 启动开发环境
npm test          # 运行测试
npm run lint      # 运行 ESLint
npm run build     # 创建生产构建
npm run start     # 启动生产服务
```

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zod
- DeepSeek Chat Completions API
- Supabase（可选）
