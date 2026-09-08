/** 种子稿：今天 Parvis 盲测；下一工作日 Harness */

export { ARTICLE_PARVIS_BLINDTEST as ARTICLE_GIS } from "./parvis-blindtest-article";

export const ARTICLE_HARNESS = {
  title: "模型越来越强，Agent 为什么还是干不完活？我开始理解 Harness 了",
  digest:
    "单项任务都能做，复杂项目却掉链子。Model 决定能力上限，Harness 决定兑现率。DeepSeek Harness 真正值得看的，可能是 Harness 这件事本身。",
  coverCopy: "Model 决定上限，Harness 决定兑现率",
  section: "工具与工作流" as const,
  coreViewpoint: "Model 决定能力上限，Harness 决定能力兑现率。",
  painPoint: "模型越来越强，复杂长任务却仍经常做不完整。",
  openingHook: "最近聊 AI Agent，大家最爱问的还是：它用的是什么模型？",
  body: `最近聊 AI Agent，大家最爱问的还是：

**它用的是什么模型？**

GPT、Claude、Gemini，还是 DeepSeek？

模型当然重要。

可要是眼光一直停在“模型够不够聪明”上，重点可能已经偏了。

今天的大模型会很多事：写代码、搜索、读文件、调 API、操作数据库、分析数据，甚至跑 GIS、控浏览器、调用专业软件。

奇怪的是，单项任务它往往都能做；一旦丢给它几十步、几小时甚至几天的复杂项目，就开始掉链子。

漏步骤。

算完不检查。

工具报错以后硬编。

执行一半忘了前面做过什么。

数据更新了，旧结论没跟着更新。

文件生成了，做到哪一步它自己也说不清。

这时候更该问的是：

> **这个模型，生活在什么样的工作系统里？**

我也是最近看 DeepSeek Harness，才把这件事想得更清楚。

DeepSeek 给了一个很短的公式：

# **Agent = Model + Harness**

他们对 Harness 的说法也直白：模型是核心，Harness 负责让 Agent 理解环境、使用工具，并在真实环境里持续干活。DeepSeek Harness 还在 Developer Preview，谈不上成熟的生产级标准，但架构思路值得看。

更值得盯的，是 **Harness** 这件事本身。

![Agent = Model + Harness 公式示意](待替换-上传图片后填链接)

<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）
简约扁平概念信息图，16:9，浅色背景，微信公众号配图。中央大公式「Agent = Model + Harness」。左侧「Model」用大脑/芯片隐喻，标注「能力上限」；右侧「Harness」用工作台、工具、Session、验证模块拼装，标注「兑现率」。底部金句「Model 决定上限，Harness 决定兑现率」。中文标注，蓝灰点缀，无品牌 logo，非写实照片。
-->

---

# Harness 到底是什么？

光看名字，DeepSeek Harness 很容易被当成又一个 Coding Agent。

我更愿意把它看成 **Agent 的运行底座**：一个让模型真正能干活的环境。

从聊天机器人到 Agent，光有“大脑”不够。它还要文件、数据库、浏览器、API、Shell、Sandbox，要工具调用和权限，要 Session、Memory、Workflow，要状态、日志、验证、失败恢复，还要明确的任务终止条件。

这些凑齐了，模型才有地方工作。

**Model 决定它会不会。**

**Harness 决定它能不能把能力组织起来，稳定做完。**

所以我现在更爱这句话：

# **Model 决定能力上限，Harness 决定能力兑现率。**

---

# 拿一个城市规划任务举例

假设任务是：

> 找出距离轨道站 800 米以内、属于低效用地、避开生态保护区、面积大于 2 公顷，且存在增密潜力的 TOD 更新地块。

普通聊天模型多半会很快告诉你：该看轨道可达性、现状用地、生态约束、面积、容积率和开发潜力，甚至能写出一篇结构完整的规划分析报告。

看着专业，其实只是在回答：**这件事通常该怎么做。**

真正的 Agent 会先读项目数据，检查输入是否齐全，确认坐标系，拉取轨道站点，做 **800 米缓冲**，叠加现状用地，筛低效用地，叠生态保护区并排除受限区，按 **2 公顷**再滤一遍，读规划条件，算现状与允许开发强度的差值，评增密潜力，生成候选地块并评分，输出 GIS 图层、地图、指标表和报告。

然后换一条路径复核：800 米有没有漏、生态区有没有真排除、面积坐标系对不对、2 公顷阈值有没有严格执行、报告数字和图层能不能对上。

这叫 **执行一次规划分析**。

前面那种叫 **生成一篇“如何做规划分析”的文字**。

两者看起来只差几个工具调用，实际上差一整套 Harness。

![TOD 更新地块 GIS 分析与验证流程](待替换-上传图片后填链接)

<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）
城市规划 GIS 流程信息图，16:9，浅色背景，微信公众号配图。横向步骤：读数据 → 确认坐标系 → 轨道站 800m Buffer → 叠加低效用地 → 排除生态保护区 → 面积>2公顷筛选 → 增密潜力评估 → 输出图层/地图/指标表/报告 → 独立验证。旁注「聊天模型：告诉你怎么做」对比「Agent：真正执行并验证」。中文标注，专业规划咨询风格，非卫星实拍。
-->

---

# DeepSeek Harness：Everything is a Plugin

DeepSeek Harness 把核心架构压成一句话：

# **Everything is a Plugin**

一切皆插件。

这里的插件，不是“给 AI 多装几个小工具”。模型、工具、Skill、Session、Sandbox、Storage、Agent Loop、Scheduling，连 UI 都可以做成可组合、可替换、可扩展的能力。底层 Cordis 内核主要管插件加载、卸载和依赖；具体 Agent 能力都长在插件里。

有意思的地方，是 **Agent 终于可以像工程系统一样被拆开、组合和设计。**

模型不行就换。

搜索工具不行就换。

Sandbox、Memory、Agent Loop 不合适，也可以换。

能力不再硬编码进一个巨大 Agent，而是拆成职责清楚、接口清楚的模块。

所以这句话里，我更看重两个字：

# **解耦。**

解耦之后，工程师才问得清：哪个模块出了问题？该换哪一块？哪一段要按专业场景重写？哪些能力现在根本不该进 Context？

这才开始像 Agent Engineering。

![Everything is a Plugin 解耦架构示意](待替换-上传图片后填链接)

<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）
简约扁平系统架构图，16:9，浅色背景。中心小内核标注「Cordis」；周围可插拔模块卡片：Model、Tool、Skill、Session、Sandbox、Storage、Agent Loop、UI，箭头表示加载/替换。标题「Everything is a Plugin」，副标题「解耦」。中文标注，模块边框清晰，无品牌 logo，非写实照片。
-->

---

# Skill、Tool、Plugin 不在同一层

这块特别容易混。

大家做 Agent 很爱加 Skill：PDF、Research、数据分析、写作、GIS。

但 Skill、Tool、Plugin 不在一个层级。

**Skill 是方法。** 它告诉 Agent 通常怎么干。一个 GIS Skill 可能写：先查坐标系，再 Buffer，再 Intersect，最后算面积。像有经验的人写下的 SOP。

光知道怎么做不够。Agent 还得能真正调用 \`buffer()\`、\`intersect()\`、\`clip()\`、\`calculate_area()\`、\`spatial_join()\`。这些更接近 **Tool**：真正执行动作的手。

**Plugin** 则是 Harness 里的装配机制。在 DeepSeek Harness 里，Skill、Tool、Model、Session、Sandbox 等能力本身，都可以通过插件接入和管理。

压成一句：

**Skill 给方法，Tool 给能力，Plugin 把能力装进系统。**

![Skill / Tool / Plugin 三层关系](待替换-上传图片后填链接)

<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）
三层关系信息图，16:9，浅色背景。自上而下三层卡片：Skill「方法 / SOP」示例「先 Buffer 再 Intersect」；Tool「能力 / 手」示例「buffer() · intersect() · calculate_area()」；Plugin「装配机制」示例「把能力装进系统」。底部一句话「Skill 给方法，Tool 给能力，Plugin 负责装配」。中文标注，清晰克制，非写实照片。
-->

---

# 能力越多，不一定越好

常见错觉是：Agent 不够强，就继续加。再加 Tool，再加十几个 Skill，再塞知识库，再开 Browser，再挂 MCP。身上挂几十种能力，看着无所不能。

真跑起来，模型每一步都要重新判断：现在该调什么？相近 Skill 选哪一个？Tool 有没有重叠？这段 Context 和当前任务有没有关系？

我现在更认这句话：

# **Agent 设计的重点，是减少能力噪音。**

好的 Agent 不一定工具最多，而是 **在正确的时间，只出现正确的能力。**

---

# Every run is traceable

DeepSeek Harness 还有一句更工程的话：

# **Every run is traceable**

每一次运行，都有迹可循。

它会把一次运行里模型看到和经历的关键事件写入 append-only 的 Session Log：系统提示、推理记录、工具调用及结果、子 Agent 调度、Context 注入。同一条事件流还能 Resume、Fork、Search、Replay。

这听起来没有“推理能力提升 30%”那么性感。做过长任务就知道它有多要紧。

跑了几十步之后，你迟早会问：这个结果怎么来的？这个数字是哪一步算的？这个文件谁生成的？哪个工具返回了这个值？失败卡在哪？中断了还能不能续上？

系统要是连“刚才发生了什么”都答不上，谈不上可靠。

成熟 Agent 的高级能力，包括 **每一步都经得起追问。**

![Every run is traceable Session Log 示意](待替换-上传图片后填链接)

<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）
时间线/事件流信息图，16:9，浅色背景。标题「Every run is traceable」。一条 append-only Session Log：系统提示 → 推理 → 工具调用及结果 → 子 Agent 调度 → Context 注入。右侧能力标签：Resume、Fork、Search、Replay。底部文案「每一步都能被追溯」。中文标注，工程感，非写实照片。
-->

---

# 从 Prompt，到 Context，再到 Harness

这几年 AI 应用的工程关注点，一直在往模型外面挪。

最早大家琢磨 **怎么问**：Prompt、Role、Few-shot、格式。这是 Prompt Engineering。

后来发现光会问不够。再聪明的人，手里没资料也办不成事。于是问题变成 **该让模型看到什么**：RAG、Memory、长上下文、搜索、项目知识库。Context Engineering 变得重要。

资料给够了，Context 塞满了，项目照样可能砸：漏步骤、失败不重试、做完不验证、状态中途丢失、旧数据和新结论打架、错误已经发生任务还在往后跑。

关注点继续外推：

# **该让模型在什么样的系统里干活？**

这是我理解的 Harness Engineering。它管 Tool、Sandbox、Permission、Session、State、Workflow、Evaluator、Logging、Recovery、Termination。

三层并不互相淘汰。Prompt 还重要，Context 还重要，Harness 也不是模型变笨时的万能补药。变的是工程重心在往外扩。

**Prompt Engineering：怎么问。**

**Context Engineering：让它知道什么。**

**Harness Engineering：让它怎么工作。**

前两层帮模型把任务理解准、把信息拿全。第三层先认账：模型一定会犯错，然后设计 **就算偶尔犯傻，系统还能不能把事办完。**

# **一次模型错误，不该直接变成一次系统失败。**

![从 Prompt 到 Context 再到 Harness](待替换-上传图片后填链接)

<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）
三阶段演进信息图，16:9，浅色背景。从左到右三块：Prompt Engineering「怎么问」；Context Engineering「让它知道什么」；Harness Engineering「让它怎么工作」。箭头向外扩张，最右侧强调「模型错误 ≠ 系统失败」。中文标注，扁平专业风，非写实照片。
-->

---

# 什么样的 Agent，开始有点生产系统的味道？

我现在主要看六件事。

## 1. Done 必须能被验证

Agent 说一句“任务已完成”，不够。

任务如果是生成城市设计分析报告，真正完成不能只看 \`report.docx\` 在不在。还要看：交通分析有没有、用地分析有没有、指标表有没有、地图有没有、数据来源有没有、关键数字有没有复核、图文表是否一致。

都过了，状态才能从 \`RUNNING\` 进 \`DONE\`。

# **Done 是工程状态，不是模型的一句话。**

## 2. 关键知识必须可验证

专业工作里，“根据我的知识……”很危险。法规会更新，规范会换版，项目资料会改，数据库会变，训练数据里的记忆也可能过期。

关键事实要带着来源、时间、版本、出处、适用范围进系统。模型脑子里的“我记得”，不能直接当事实。

对专业 Agent 来说，答案重要；**答案从哪来的，往往更重要。**

## 3. Agent 得有眼睛和手

Coding Agent 这几年快，不只是因为模型会写代码，而是它已经能跑通：看代码、改代码、运行、看报错、再改、再测。

城市规划也该这样。面积别让 LLM 猜大概 2.3 公顷，让它调 GIS 去算。800 米规范别靠“我记得”，去检索规范。容积率别心算，交给 Indicator Calculator。

# **LLM 决定做什么，专业引擎负责算。**

模型负责推理、判断、编排；确定性系统负责计算、执行和验证。

## 4. 长任务状态必须外置

几十步、几百步的项目，状态全压在 Context 里，迟早出事。做到哪一步、哪些数据已验证、用了什么参数、哪个文件最新、哪个结果已废弃、哪些任务失败过、当前版本对应哪套数据，这些都该进文件、数据库、Git、Session Store、Task State，或其他持久化系统。

任务中断后才能恢复，也不用靠“我好像记得刚才做到这里”。

长任务 Agent 应该能：**停下来，重启，读状态，继续跑。**

## 5. 关键结果要有独立验证路径

自己生成、自己检查、自己宣布正确，还是自己做题自己批卷。

主 Agent 算出容积率 = 3.5，验证程序最好从原始面积和建筑规模再算一遍。主 Agent 说图文表一致，Validator 最好独立读图、表、文字比对。

独立不一定再开一个大模型。能用代码就用代码，能用数据库约束就用约束，能用规则就用规则；高风险、模糊的结果，再交给独立 Evaluator 或人工。

# **生成和验证，不能只有同一条逻辑链。**

## 6. 权限必须机械化

系统提示里写“请不要删除生产文件”，只是软约束。模型一旦理解偏了，该删还可能删。

靠谱做法是：不给 Delete，限制工作目录，生产库只读，关键资源隔离，危险操作要人工确认，Sandbox 限制进程和网络。

# **别只告诉它不能做什么，要让它真的做不了。**

Prompt 可以约束行为；安全边界要由 Permission、Sandbox 和系统权限承担。

---

# 落到城市规划 Agent，事情就不一样了

按上面这些原则搭，城市规划 Agent 不会只是“GPT + 一个规划 Prompt”。

**数据层**：Planning Data Catalog、项目文件、GIS、数据库、Document Reader。

**计算层**：GIS Spatial Engine、Indicator Calculator、Accessibility Tool。

**知识层**：Planning Regulation Search、标准规范库、项目知识库。

**生成层**：Scenario Generator、Map Generator、Report Generator。

**验证层**：Planning Evaluator、Evidence Ledger、数据一致性检查。

后面接 GPT、Claude 还是 DeepSeek，当然重要，但已经不是全部。更难的问题变成：数据对不对、Tool 能不能真调、状态会不会丢、结果能不能验证、出错能不能恢复、有没有数据版本、权限边界在哪、什么时候才算 Done。

![城市规划 Agent 五层能力结构](待替换-上传图片后填链接)

<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）
五层架构图，16:9，浅色背景。自上而下：数据层（Planning Data Catalog / GIS / 数据库）、计算层（GIS Engine / Indicator Calculator）、知识层（规范检索 / 项目知识库）、生成层（Scenario / Map / Report）、验证层（Evaluator / Evidence Ledger）。顶部标注「专业 Agent = 执行链，而不只是 GPT + Prompt」。中文标注，扁平架构风，非写实照片。
-->

---

# DeepSeek Harness 真正值得看的，可能是 Harness

这也是我觉得 Harness 方向比单纯盯模型 Benchmark 更值得长期看的原因。

行业很容易陷入节奏：GPT 又升级，Claude 又发新模型，Gemini Context 又变长，DeepSeek 推理又更强。然后默认 **Model 更聪明 = Agent 一定更强。**

现实不一定。

模型再强，如果没有可靠 Tool、State、Data Version、Evaluator、Permission、Recovery 和明确 Done，它仍可能只是一个很聪明、但工作流程很乱的人。

模型就算不绝对领先，只要数据、工具、状态、权限、工作流和验证可靠，复杂项目里的交付稳定性反而可能更高。

Harness 替代不了 Model。弱模型不会因为装上一套好 Harness，就突然长出没有的推理能力。

更准的关系是：

# **Model 决定能力上限。**

# **Harness 决定这些能力能兑现多少。**

---

# 竞争，正在从“智商”转向“组织能力”

大模型像员工的大脑。

Harness 更像公司的工作台、工具软件、数据库、SOP、项目管理、权限、质检、日志、知识库和复核机制。

人聪明，组织不一定能稳定交付。AI 也一样。

以前容易把 Agent 理解成 **更聪明的聊天机器人**。真正的 Agent 更接近 **由模型驱动的软件执行系统**。

前者看回答好不好。

后者看事情有没有做完。

---

# 收口

过去我们研究怎么让模型答得更好：Prompt Engineering，管 **怎么问**。

后来研究怎么让模型拿到正确信息：Context Engineering，管 **它该知道什么**。

现在问题继续外推：Harness Engineering，管 **怎么把事情真正做完**。

以后再看一个 Agent，我可能不会只问后面接什么模型。我还会问：有什么工具？状态存在哪？结果怎么验证？中断怎么恢复？数据从哪来？权限怎么控？失败怎么办？什么时候叫 Done？

从 **会回答** 走到 **能交付**，往往靠外面有没有一套够稳的 Harness，Benchmark 多几分少几分反而不那么关键。

**Model 决定它能不能做到。**

**Harness 决定它能不能一次又一次，稳定地做到。**

这可能才是下一阶段 Agent Engineering 真正值得啃的地方。`,
};
