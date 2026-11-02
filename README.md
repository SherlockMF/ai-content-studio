# 微信公众号 & 小红书 AI 内容工作台

**AI Content Studio** 是一个本地优先的内容创作工作台，帮助创作者管理选题、资料、公众号文章和小红书图文，从初稿、配图到发布前检查集中处理。

> 发布由创作者手动完成。AI 生成的内容、事实和图片请在发布前自行核对。

## 可以做什么

- **选题与资料**：整理选题、知识资料、稿件状态和发布排期。
- **公众号文章**：生成与编辑稿件，导入 Markdown，管理封面提示词和正文配图，预览、复制或导出发布素材。
- **小红书图文**：根据公众号稿件改编两种可编辑文案，规划配图与提示词，导出图文 ZIP 发布包。
- **发布前检查**：检查稿件及小红书发布内容；公众号的“发布前检查”还可能润色正文并处理配图。
- **本地优先**：稿件等业务数据默认保存在浏览器，可手动备份，也可选用 Supabase 快照同步。

## 快速开始

需要 Node.js **20.9.0 或更高版本**、npm，以及用于 AI 写作的 DeepSeek API Key。使用内置生图功能还需要 DashScope API Key。

```bash
git clone https://github.com/SherlockMF/ai-content-studio.git
cd ai-content-studio
npm ci
npm run dev
```

打开 [http://localhost:52728](http://localhost:52728)，进入“设置”配置模型，然后从“选题”或“稿件”开始创作。也可以在项目根目录创建 `.env.local`：

```dotenv
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash

# 仅使用内置生图时需要
DASHSCOPE_API_KEY=your_dashscope_api_key
```

服务端优先读取 `.env.local` 中的 Key；没有配置时使用设置页中保存在本机浏览器的 Key。修改 `.env.local` 后需重启服务。不要提交真实密钥。

## 使用流程

1. 在“选题”中整理方向，或在“稿件”中导入已有 Markdown。
2. 编辑公众号标题、摘要和正文，检查或上传配图。
3. 在预览中选择工作台内置的排版主题，检查后复制富文本，粘贴到公众号编辑器；标题、摘要和封面在微信后台另行填写。
4. 需要小红书版本时，点击“转小红书”，编辑文案、处理配图并导出发布包。
5. 在对应平台人工核对并发布。

### 公众号排版技能

仓库包含 [gzh-design 项目技能](.agents/skills/gzh-design/SKILL.md)，提供六套主题、组件库及校验脚本，可供支持项目技能的 Codex 使用。可以在项目对话中提出“用石墨极简风排版这篇公众号文章”。

这个技能与工作台的内置预览主题是两套入口：**工作台不会因为技能文件存在就自动调用该技能**。技能来自 [isjiamu/gzh-design-skill](https://github.com/isjiamu/gzh-design-skill)，遵循其目录内的 AGPL 许可证。

## 数据与备份

- 稿件和设置默认保存在当前浏览器的本地存储中。浏览器、主机名或端口变化可能使用另一份数据；建议固定使用 `http://localhost:52728`。
- 在设置页使用“备份本地稿件数据”导出备份。备份不含 API Key，图片文件仍保存在项目的 `public/article-assets/` 目录，需要另行备份。
- 不配置 Supabase 也可使用本地工作台。需要快照同步时，先在自己的 Supabase 项目中运行 `supabase/migrations/` 下的 SQL，再在 `.env.local` 中配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，重启后在设置页手动推送或拉取。快照不包含模型 API Key。
- 快照使用固定标识，项目本身未提供多用户隔离；使用 Supabase 前请自行配置访问控制，避免将稿件暴露给无关人员。

## 常用命令

```bash
npm run dev    # 启动开发服务
npm test       # 运行测试
npm run lint   # 检查代码
npm run build  # 创建生产构建
npm run start  # 启动生产服务
```

## 技术与资料

项目使用 Next.js、React、TypeScript、Tailwind CSS 和 Zod；模型接入 DeepSeek，图片生成接入 DashScope，Supabase 为可选同步服务。

选题、发布与改稿的运营规则见 [内容运营手册](docs/playbooks/content-topic-publish-revision.md)。
