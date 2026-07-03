# 💰 个人记账 APP

一款基于 **Electron** 的 Windows 桌面记账应用，支持两级分类、月度统计、Excel 导入导出，内置贪吃蛇小游戏。集成了 **Claude Code** 的 AI 辅助开发体系（Skills + Subagents + 质量门）。

---

## 功能

### 📝 记账
- 记一笔：金额、大类、小类、日期、备注
- 支出列表：按时间倒序，按日期分组
- 分类筛选：按大类过滤支出记录
- 分类管理：自定义大类/小类，增删改
- **Emoji 选择器**：60+ emoji 一键选择分类图标
- 编辑/删除：点击编辑，右键删除

### 📊 统计
- 月度统计：甜甜圈图展示各大类支出占比

### 📥📤 数据导入导出
- **导出 Excel**：一键导出所有记录为 `.xlsx` 文件
- **导入 Excel**：从 `.xlsx` / `.csv` 导入记录（自动识别中英文表头，只新增不覆盖）

### 🐍 贪吃蛇
- 内置 Canvas 贪吃蛇小游戏
- 方向键 + **WASD** 双模式控制
- 打开后不自动开始，按**空格键**或点击按钮开始

### 🎨 界面
- 二次元风渐变背景 + 装饰光斑
- 紫色系配色 + 毛玻璃效果
- 按钮悬停动画

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端 | HTML + CSS + Vanilla JS |
| 数据库 | SQLite（sql.js） |
| 图表 | Chart.js 4 |
| Excel | SheetJS (xlsx) |
| 测试 | Vitest + jsdom |
| 打包 | electron-builder (NSIS .exe) |

---

## 快速开始

### 下载使用（普通用户）

去 [Releases](https://github.com/MikasaiLove/study-test/releases) 下载最新 `.exe` 安装包，双击安装即可。

### 开发运行

```bash
git clone git@github.com:MikasaiLove/study-test.git
cd study-test
npm install

# 启动
node start-launcher.js
```

### 打包

```bash
npm run build
# 输出：release/个人记账 Setup x.x.x.exe
```

### 测试

```bash
npm test
```

---

## 项目结构

```
个人记账APP/
├── main.js                  # Electron 主进程（窗口、数据库、IPC、导入导出）
├── preload.js               # 安全桥接（contextBridge）
├── start-launcher.js        # 启动脚本
├── renderer/
│   ├── index.html           # 主界面
│   ├── style.css            # 样式（二次元风主题）
│   ├── app.js               # 前端主逻辑（记账 + 贪吃蛇 + 导入导出）
│   ├── utils.js             # 纯工具函数（日期、分类处理）
│   └── chart.umd.min.js     # Chart.js 库
├── tests/
│   └── utils.test.js        # 单元测试（21 条）
├── data/
│   └── accounting.db        # SQLite 数据库（自动生成）
├── .claude/
│   ├── agents/              # Claude Code 子代理
│   ├── skills/              # Claude Code 技能
│   └── memory/              # 项目记忆
└── package.json
```

---

## 数据库设计

### categories（分类表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 分类名称 |
| type | TEXT | major=大类 / minor=小类 |
| parent_id | INTEGER | 所属大类 ID |
| icon | TEXT | emoji 图标 |
| is_preset | INTEGER | 1=预设 / 0=用户自建 |

### expenses（支出记录表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| amount | REAL | 金额（元） |
| category_major | TEXT | 大类名称 |
| category_minor | TEXT | 小类名称 |
| date | TEXT | YYYY-MM-DD |
| note | TEXT | 备注 |

---

## 预设分类

9 大类 + 40+ 小类：

🍜 餐饮 | 🚗 交通 | 🛒 购物 | 🏠 住房 | 🎮 娱乐 | 💊 医疗 | 📚 教育 | 🎁 人情 | 📦 其他

---

## 数据存储

| 场景 | 路径 |
|------|------|
| 开发运行 | `项目目录/data/accounting.db` |
| 安装后运行 | `C:\Users\<用户名>\AppData\Roaming\个人记账\accounting.db` |

备份数据库文件即可迁移数据。

---

## Claude Code AI 辅助体系

本项目集成了 Claude Code 的 Skills 和 Subagents，用于自动化开发流程。

> ⚠️ **重要**：以下 Skills 和 Subagents **仅适用于 Claude Code**（Anthropic 官方 CLI），不支持 GitHub Copilot / Cursor / Cline 等其他 AI 工具。使用者需安装 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 并打开本项目，方可使用这些功能。普通用户下载 exe 直接使用即可，无需任何 AI 工具。

### Skills（技能 — `/` 指令调用）

| 指令 | 位置 | 功能 |
|------|------|------|
| `/git-save` | 全局（需自行配置） | 一键 `git add` → `commit` → `push` |
| `/unit-test` | 项目 | 评估项目 → 安装框架 → 找测试目标 → 写测试 → 执行 → 报告 |
| `/comments-check` | 项目 | 检查注释完整性（≥30%）、准确性、小白可读性 |
| `/security-audit` | 项目 | 查敏感信息泄露、SQL 注入、Electron 安全配置、危险代码等 |

> `/git-save` 是全局技能，存储在 `~/.claude/skills/`，不会被克隆到本地。其他三个技能已在 `项目/.claude/skills/` 中，克隆仓库后即可使用。

### Subagents（子代理 — 后台独立运行）

| Agent | 装载技能 | 功能 |
|-------|---------|------|
| `tester` | unit-test | 独立运行单元测试 |
| `quality-engineer` | security-audit + comments-check + 代码规范 | 安全 + 注释 + 规范 三合一审查 |
| `gitcommit-agent` | tester + quality-engineer + git-save | **质量门提交**：并行跑 tester 和 quality-engineer → 双 PASS 才允许 commit + push |

### 质量门流程

```
/gitcommit-agent
      │
      ├─ tester (并行)          → 写 .test-result.json
      └─ quality-engineer (并行) → 写 .quality-result.json
      │
      ▼
  双 PASS → git commit + push → 清理通行证
  任一 FAIL → 拒绝提交 + 显示原因
```

---

## License

MIT
