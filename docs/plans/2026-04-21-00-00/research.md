---
topic: 工作计时器与人天统计应用
date: 2026-04-21
research_scope:
  codebase: false
  internet: true
source:
  initial: docs/plans/2026-04-21-00-00/initial.md
  research_topics: docs/plans/2026-04-21-00-00/research-topics.md
---

## 1. Research Summary（研究摘要）

本次研究聚焦于时间追踪应用（Time Tracking）的设计模式与最佳实践，为用户构建一个带有人天统计和休息时间管理的工作计时器应用提供决策支持。通过调研 Toggl Track、Clockify、RescueTime、Harvest、Pomofocus 等主流工具，我们发现业界在计时交互、休息处理、人天换算等方面已形成较为成熟的做法。用户的核心需求（开始/停止计时、固定休息时间扣除、人天统计）均有可参考的实现模式。

## 2. Project Findings（项目内发现）

本次未进行项目内探索（用户选择跳过）。

## 3. Best Practice Findings（最佳实践发现）

### 3.1 Common Approaches（常见做法）

**主流工具功能对比：**

| 工具 | 计时模式 | 多任务支持 | 中断/暂停处理 | 核心特点 |
|------|----------|------------|---------------|----------|
| **Toggl Track** | 一键开始/停止 + 手动补录 | 支持多项目任务切换 | 可切换任务，自动记录切换时间 | 离线追踪、日历视图、一键继续 |
| **Clockify** | 计时器 + 手动输入 + 自动追踪 | 项目/任务/标签多层 | 支持暂停，Breaks 追踪 | Kiosk 打卡、休息时间追踪 |
| **RescueTime** | 全自动后台追踪 | 自动识别应用和网站 | 自动记录 | 被动追踪、生产力评分 |
| **Harvest** | 实时计时器 + 手动录入 | 项目和任务追踪 | 支持切换和编辑 | 预算追踪、发票生成 |
| **Pomofocus** | 固定 25 分钟 + 5 分钟休息 | 任务列表 | 番茄钟不可分割 | 结构化休息、视觉报表 |

**开始/停止计时的交互模式：**

- **大按钮一键开始/停止**：最普遍的交互方式，Toggl 的粉色播放按钮、Pomofocus 的大圆形计时器都是代表
- **任务列表 + 行内计时**：在任务列表的每一行显示开始/停止按钮，适合多任务
- **快捷键/全局热键**：桌面应用支持全局快捷键，减少切换成本
- **继续（Continue）功能**：一键复用最近的时间条目，提升效率

**休息/暂停处理模式：**

- **固定休息时间（Pomodoro）**：25 分钟工作 → 5 分钟短休 → 每 4 循环后长休
- **手动标记休息（Clockify）**：用户手动点击"开始休息"和"结束休息"，休息时间从工时中扣除
- **自动检测空闲（Toggl Desktop）**：检测到用户离开电脑后，提示是否将空闲时间记为休息或删除

### 3.2 Official Recommendations（官方建议）

- **人时（Man-hour）定义**：仅计算纯劳动时间，不包括休息、吃饭等中断（来源：维基百科 Man-hour 词条）
- **人天换算**：1 人天 = 8 人时（标准工作制）；1 人年 ≈ 2000 小时（来源：美国海军标准）
- **国际劳工标准**：1919 年《工时（工业）公约》规定工时限制和休息权利（来源：ILO）
- **Toggl 最佳实践**：明确追踪目的、简化系统、鼓励休息、使用数据驱动决策

### 3.3 Known Pitfalls（已知陷阱）

- **过度复杂的分类体系**：过多层级会降低采用率，建议保持 3 层以内
- **强制连续追踪**：不允许暂停会导致数据失真，用户会忘记停止计时器
- **休息时间处理不一致**：有时扣除有时不扣除会导致报表混乱
- **忽视离线/中断场景**：没有处理会议、电话等机制会产生大量错误数据
- **人天换算陷阱**：简单按 8 小时换算可能忽略实际效率和非项目时间

### 3.4 SOTA / Emerging Practices（前沿实践）

- **AI 自动分类**：基于应用和网站自动识别任务类型
- **生产力评分**：RescueTime 通过机器学习评估不同活动的生产力水平
- **Focus Session**：主动阻断干扰应用，提升专注度

## 4. Trade-offs Analysis（权衡分析）

### Trade-off 1：手动计时 vs 自动追踪
- **手动计时（A）的优势**：用户控制感强、数据准确意图明确、实现简单
- **自动追踪（B）的优势**：零操作成本、不会遗漏、数据全面
- **建议**：本项目采用手动计时为主，因为用户需要"点击开始/停止"的明确控制，且自动追踪实现复杂度较高

### Trade-off 2：固定休息时间 vs 动态休息
- **固定休息时间（A）的优势**：计算简单、报表清晰、符合常规工作制度
- **动态休息（B）的优势**：更灵活、适合不规律工作模式
- **建议**：采用固定休息时间（用户已明确需求），但允许用户自定义休息时长

### Trade-off 3：休息时间扣除逻辑
- **从总工时扣除（A）的优势**：纯劳动时间更准确、符合人时定义
- **不扣除仅标注（B）的优势**：总在线时间可见、避免数据误解
- **建议**：两种数据都展示——显示"总在线时间"和"有效工时（扣除休息）"，人天统计基于有效工时

## 5. Key References（关键参考）

### 5.2 External Links（外部链接）

- https://toggl.com/track/features/ - Toggl Track 功能介绍
- https://clockify.me/features - Clockify 功能介绍
- https://www.rescuetime.com/features - RescueTime 功能介绍
- https://www.getharvest.com/features - Harvest 功能介绍
- https://pomofocus.io/ - Pomofocus 番茄钟工具
- https://en.wikipedia.org/wiki/Pomodoro_Technique - 番茄工作法
- https://en.wikipedia.org/wiki/Man-hour - 人时/人天定义
- https://www.ilo.org/global/topics/working-time/lang--en/index.htm - 国际劳工组织工时标准
- https://toggl.com/blog/time-tracking-best-practices - Toggl 时间追踪最佳实践

## 6. Open Questions for Design（留给 design 的问题）

- **Q1**：应用的技术形态是什么？（Web 应用、桌面应用、还是移动端？）
- **Q2**：数据持久化需求？（本地存储即可，还是需要云端同步？）
- **Q3**：休息时间的具体规则？（固定几点到几点休息，还是固定时长？）
- **Q4**：是否支持多任务并行计时，还是单任务串行？
- **Q5**：历史记录和报表的详细程度？（仅需今日数据，还是需要周/月统计？）

---

**Research Completed:** 2026-04-21  
**Next Step:** 进入 Step 4（用户访谈），使用本 research 作为输入。

