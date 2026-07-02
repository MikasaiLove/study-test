# 个人记账 APP — 项目文档

## 项目概述

一款 Windows 桌面记账应用，帮助用户记录日常人民币支出，支持两级分类和月度统计。

- **技术栈**：Electron + HTML/CSS/JavaScript + SQLite（sql.js）
- **运行平台**：Windows
- **打包格式**：.exe 安装包（electron-builder）

---

## 如何运行

### 方式一：使用启动脚本（推荐）
```bash
node start-launcher.js
```

### 方式二：命令行
```bash
# 必须先清除 VS Code 注入的环境变量！
# Windows PowerShell:
$env:ELECTRON_RUN_AS_NODE=""
npx electron .

# Windows CMD:
set ELECTRON_RUN_AS_NODE=
npx electron .

# Git Bash:
ELECTRON_RUN_AS_NODE= npx electron .
```

> ⚠️ **重要**：VS Code 终端会设置 `ELECTRON_RUN_AS_NODE=1`，导致 Electron 被当作纯 Node.js 运行，`require('electron')` 会解析为字符串路径而不是 API 对象。这是 [Electron Bug #49034](https://github.com/electron/electron/issues/49034)。启动前必须清除此环境变量。

---

## 项目结构

```
个人记账APP/
├── CLAUDE.md              # 本文档
├── package.json           # 项目配置
├── start-launcher.js      # 启动脚本（修复环境变量问题）
├── main.js                # Electron 主进程（窗口、数据库、IPC）
├── preload.js             # 安全桥接（前端→后端通信）
├── renderer/
│   ├── index.html         # 主界面
│   ├── style.css          # 样式
│   └── app.js             # 前端逻辑
├── data/
│   └── accounting.db      # SQLite 数据库文件（自动生成）
└── node_modules/          # 依赖包
```

---

## 技术决策记录

### 1. 技术栈：Electron（HTML/CSS/JS）
- **选择原因**：界面美观、学习门槛低、跨平台、生态丰富
- **替代方案**：Python+Tkinter、C# WinForms、Tauri
- **决策日期**：2026-07-02

### 2. 数据库：sql.js（纯 JS 版 SQLite）
- **选择原因**：无需 C++ 编译工具，跨平台零配置
- **替代方案**：better-sqlite3（需要 Visual Studio 编译）、electron-store（JSON 文件）
- **决策日期**：2026-07-02

### 3. 图表库：Chart.js
- **选择原因**：轻量、易用、饼图/柱状图支持好
- **替代方案**：ECharts（功能更强但体积大）

---

## 数据库设计

### categories 表（分类）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 分类名称 |
| type | TEXT | 'major'=大类 / 'minor'=小类 |
| parent_id | INTEGER | 所属大类ID |
| icon | TEXT | emoji 图标 |
| sort_order | INTEGER | 排序 |

### expenses 表（支出记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| amount | REAL | 金额（元） |
| category_major | TEXT | 大类名称 |
| category_minor | TEXT | 小类名称 |
| date | TEXT | 日期 YYYY-MM-DD |
| note | TEXT | 备注 |
| created_at | TEXT | 创建时间 |

---

## 预设分类

9 大类 + 40+ 小类，覆盖日常支出场景：
🍜餐饮 🚗交通 🛒购物 🏠住房 🎮娱乐 💊医疗 📚教育 🎁人情 📦其他

---

## 已知问题 & 解决方案

### ELECTRON_RUN_AS_NODE 环境变量冲突
- **问题**：VS Code 设置 `ELECTRON_RUN_AS_NODE=1`，导致 `require('electron')` 返回错误值
- **解决**：使用 `start-launcher.js` 或手动清除该环境变量
- **参考**：https://github.com/electron/electron/issues/49034

---

## 项目约定

1. **代码注释用中文**：所有关键位置写中文注释
2. **分步实现**：功能模块逐步迭代
3. **技术决策交给用户**：提供 2-4 个方案让用户挑选
4. **数据安全**：本地存储，用户可随时备份 `data/accounting.db`
