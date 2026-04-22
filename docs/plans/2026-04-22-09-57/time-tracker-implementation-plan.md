---
topic: 计时工具 BlueprintUI 重绘与功能优化
date: 2026-04-22
status: approved
source:
  design: docs/plans/2026-04-21-00-00/time-tracker-design-v2.md
  research: docs/plans/2026-04-22-09-57/research.md
  interview: docs/plans/2026-04-22-09-57/time-tracker-interview.md
tasks_file: time-tracker-tasks.json
---

# 计时工具 BlueprintUI 重绘与功能优化 - Implementation Plan

## 1. 概述

本项目是一个单文件 HTML 计时工具（time-tracker.html），采用纯原生 Vanilla JS 构建。本次实施的目标是引入 BlueprintUI CSS 视觉系统，优化信息展示结构，并补全基础功能（追加记录、任务删除/编辑、暗黑主题）。

**技术方案**：保持纯 HTML/JS 单文件架构，通过 CDN 引入 Blueprint CSS，使用 CSS 工具类替换现有样式。

**任务总数**：8 个（4 个 P0 + 3 个 P1 + 1 个 P2）

## 2. 架构概览

- **单文件架构**：所有 HTML/CSS/JS 内嵌在 time-tracker.html 中
- **无构建工具**：零依赖，双击即用（除 CDN 外）
- **数据存储**：浏览器 localStorage，按日期隔离（`time-tracker-tasks-YYYY-MM-DD`）
- **UI 框架**：Blueprint CSS（纯样式，无 React）

## 3. 相关 ADR

- **ADR-001**：保持单文件、零构建工具架构（V2 延续）
- **ADR-002**：使用 Blueprint CSS 而非 React 组件（仅使用视觉样式）
- **ADR-003**：Completed 任务保持终态语义，通过"追加记录"新增 segment

## 4. 目录结构

```
D:\code_workspace\计时工具\
├── time-tracker.html          # 唯一入口文件（待修改）
├── package.json               # 测试脚本
├── test\                      # 测试目录
│   ├── v2-ui-skeleton.test.js
│   ├── timer.test.js
│   ├── storage.test.js
│   └── export-import.test.js
└── docs\plans\2026-04-22-09-57\
    ├── time-tracker-design.md
    ├── time-tracker-tasks.json
    └── progress.md
```

## 5. 编码约定

- **HTML/CSS**：使用 Blueprint CSS 工具类（`.bp5-*`），减少自定义样式
- **JavaScript**：沿用现有 Vanilla JS 模式，函数式组织
- **状态管理**：Task 状态机（idle → running ↔ paused → completed）
- **DOM 操作**：原生 DOM API（querySelector、addEventListener 等）
- **事件委托**：任务卡片操作使用事件委托

## 6. 质量检查命令

- **测试**：`npm test`（运行 jsdom 测试）
- **验证**：手动在浏览器中打开 time-tracker.html 验证 UI 和交互
- **代码检查**：无 lint 工具，依赖代码审查

## 7. 关键技术点

### 7.1 Blueprint CSS 引入
```html
<link href="https://unpkg.com/@blueprintjs/core@5/lib/css/blueprint.css" rel="stylesheet">
<link href="https://unpkg.com/@blueprintjs/icons@5/lib/css/blueprint-icons.css" rel="stylesheet">
```

### 7.2 主题切换
- 通过切换 `body` 的 `bp5-dark` 类实现
- 监听 `prefers-color-scheme` 媒体查询（跟随系统模式）
- 主题偏好保存到 localStorage（`time-tracker-theme`）

### 7.3 独立面板实现
- 使用 CSS `max-height: 0` → `max-height: 2000px` + `transition` 实现平滑展开/收起
- 面板内容使用 Blueprint 风格的列表和时间轴

### 7.4 确认对话框
- 纯 HTML/CSS 模拟 Blueprint Dialog（遮罩层 + 居中卡片）
- 不使用 React Portal 或第三方库

## 8. 任务列表

详见 `time-tracker-tasks.json`
