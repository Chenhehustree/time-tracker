---
topic: 工作计时器与人天统计应用
date: 2026-04-21
status: approved
source:
  design: docs/plans/2026-04-21-00-00/time-tracker-design.md
  research: docs/plans/2026-04-21-00-00/research.md
  interview: docs/plans/2026-04-21-00-00/time-tracker-interview.md
tasks_file: time-tracker-tasks.json
---

# 工作计时器与人天统计应用 - Implementation Plan

## 1. 概述

本项目是一个为个人工作者打造的**轻量 Web 计时器**，核心能力包括：开始/停止任务计时、固定休息时段自动扣除、人天换算（按 8 小时/天）、历史记录管理与 JSON 数据备份。

技术方案采用**极简路线**：单 HTML 文件内嵌 CSS 和 JavaScript，零依赖、零构建，双击即用。数据持久化使用浏览器 localStorage，导出/导入使用 JSON 格式。

**任务总数**：7 个（5 个 P0 + 2 个 P1）

**关键风险**：
1. localStorage 容量限制或用户误清缓存导致数据丢失（通过 JSON 导出备份缓解）
2. 页面刷新导致计时中断（通过 localStorage 保存计时状态缓解）
3. 跨天计时导致日期归属混乱（通过归属开始日期规则缓解）

### 1.1 任务文件

- `tasks_file`: `time-tracker-tasks.json`

### 1.2 任务执行顺序

1. **TASK-001**: 项目初始化与 HTML 骨架搭建 — 创建单 HTML 文件和基础样式框架
2. **TASK-002**: 计时器核心功能（开始/停止/状态恢复） — 实现计时交互和刷新恢复（依赖: TASK-001）
3. **TASK-003**: 任务记录管理与 localStorage 存储 — 保存/读取记录，渲染列表（依赖: TASK-002）
4. **TASK-004**: 休息时间扣除逻辑 — 休息时段配置、重叠计算、颜色标注（依赖: TASK-003）
5. **TASK-005**: 人天换算与统计面板 — 统计面板、人天换算公式、实时更新（依赖: TASK-004）
6. **TASK-006**: 历史记录查看与编辑功能 — 日期切换、记录编辑/删除/补录（依赖: TASK-003）
7. **TASK-007**: 数据导出与导入功能 — JSON 导出/导入、备份恢复（依赖: TASK-003）

## 2. 技术设计

### 2.1 设计文件

`docs/plans/2026-04-21-00-00/time-tracker-technical-design.md`

### 2.2 设计要点

- **架构**：三层架构（UI 层 + 计时器引擎 + 数据存储层），通过同步函数调用通信
- **技术栈**：原生 Vanilla JS + 原生 CSS，单 HTML 文件交付
- **存储**：浏览器 localStorage，以日期为 key 存储记录数组
- **核心算法**：
  - 休息扣除：遍历休息时段，计算与工作记录的交集时长并扣除
  - 人天换算：有效工时（分钟）÷ 480 分钟/天，保留 2 位小数
- **交付物**：一个 `time-tracker.html` 文件，双击即可在浏览器中运行

---

**Planning Completed:** 2026-04-21

