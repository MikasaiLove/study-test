// main.js — Electron 主进程
// 职责：创建APP窗口、管理数据库、处理来自前端的请求

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ============ 数据库初始化（使用 sql.js，纯 JS，无需编译工具）============

const initSqlJs = require('sql.js');

// 数据库文件路径
// 开发环境：项目目录下的 data/ 文件夹
// 打包后：用户数据目录（Windows 上是 %APPDATA%/个人记账/）
const dbPath = app.isPackaged
  ? path.join(app.getPath('userData'), 'accounting.db')
  : path.join(__dirname, 'data', 'accounting.db');

// 全局数据库对象
let db = null;

// 保存数据库到磁盘
function saveDb() {
  const data = db.export();                    // 导出数据库为二进制
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dbPath, buffer);            // 写入磁盘
}

// 初始化数据库
async function initDatabase(SQL) {
  // 如果已有数据库文件，从磁盘加载
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    // 否则创建新数据库
    db = new SQL.Database();
  }

  // 创建分类表（如果不存在）
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_id INTEGER,
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );
  `);

  // 创建支出记录表（如果不存在）
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category_major TEXT NOT NULL,
      category_minor TEXT NOT NULL,
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 首次运行时插入预设分类
  initCategories();

  // 保存到磁盘
  saveDb();
}

// 插入预设分类（仅首次运行）
function initCategories() {
  const result = db.exec('SELECT COUNT(*) as cnt FROM categories');
  const count = result[0]?.values[0]?.[0] || 0;
  if (count > 0) return; // 已有数据，跳过

  const presetData = [
    // [name, type, parent_id, icon, sort_order]
    ['餐饮', 'major', null, '🍜', 1],
    ['早餐', 'minor', 1, '', 1],
    ['午餐', 'minor', 1, '', 2],
    ['晚餐', 'minor', 1, '', 3],
    ['零食', 'minor', 1, '', 4],
    ['饮品', 'minor', 1, '', 5],
    ['聚餐', 'minor', 1, '', 6],
    ['食材', 'minor', 1, '', 7],
    ['交通', 'major', null, '🚗', 2],
    ['公交/地铁', 'minor', 2, '', 1],
    ['打车', 'minor', 2, '', 2],
    ['加油/充电', 'minor', 2, '', 3],
    ['停车费', 'minor', 2, '', 4],
    ['火车/机票', 'minor', 2, '', 5],
    ['购物', 'major', null, '🛒', 3],
    ['日用品', 'minor', 3, '', 1],
    ['衣物鞋帽', 'minor', 3, '', 2],
    ['数码产品', 'minor', 3, '', 3],
    ['家居用品', 'minor', 3, '', 4],
    ['美妆护肤', 'minor', 3, '', 5],
    ['住房', 'major', null, '🏠', 4],
    ['房租/房贷', 'minor', 4, '', 1],
    ['水费', 'minor', 4, '', 2],
    ['电费', 'minor', 4, '', 3],
    ['燃气费', 'minor', 4, '', 4],
    ['物业费', 'minor', 4, '', 5],
    ['维修', 'minor', 4, '', 6],
    ['娱乐', 'major', null, '🎮', 5],
    ['电影', 'minor', 5, '', 1],
    ['游戏', 'minor', 5, '', 2],
    ['旅游', 'minor', 5, '', 3],
    ['运动健身', 'minor', 5, '', 4],
    ['KTV', 'minor', 5, '', 5],
    ['订阅会员', 'minor', 5, '', 6],
    ['医疗', 'major', null, '💊', 6],
    ['门诊', 'minor', 6, '', 1],
    ['买药', 'minor', 6, '', 2],
    ['体检', 'minor', 6, '', 3],
    ['住院', 'minor', 6, '', 4],
    ['教育', 'major', null, '📚', 7],
    ['课程/培训', 'minor', 7, '', 1],
    ['书籍', 'minor', 7, '', 2],
    ['文具', 'minor', 7, '', 3],
    ['考试费', 'minor', 7, '', 4],
    ['人情', 'major', null, '🎁', 8],
    ['送礼', 'minor', 8, '', 1],
    ['红包', 'minor', 8, '', 2],
    ['请客', 'minor', 8, '', 3],
    ['聚会AA', 'minor', 8, '', 4],
    ['其他', 'major', null, '📦', 9],
    ['快递费', 'minor', 9, '', 1],
    ['手续/服务费', 'minor', 9, '', 2],
    ['其他支出', 'minor', 9, '', 3],
  ];

  // 批量插入，parent_id 中的数字对应上面大类的序号
  const stmt = db.prepare(
    'INSERT INTO categories (name, type, parent_id, icon, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  for (const row of presetData) {
    stmt.run(row);
  }
  stmt.free();
  console.log('预设分类已写入数据库');
}

// ============ 辅助函数：将 sql.js 查询结果转为对象数组 ============
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryRun(sql, params = []) {
  db.run(sql, params);
  saveDb(); // 写操作后保存数据库
}

// ============ IPC 通信处理 ============

// 获取所有分类
ipcMain.handle('getCategories', () => {
  return queryAll('SELECT * FROM categories ORDER BY sort_order');
});

// 添加支出记录
ipcMain.handle('addExpense', (_event, expense) => {
  const stmt = db.prepare(
    'INSERT INTO expenses (amount, category_major, category_minor, date, note) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run([expense.amount, expense.category_major, expense.category_minor, expense.date, expense.note || '']);
  stmt.free();
  saveDb();
  return { success: true };
});

// 获取所有支出记录（倒序）
ipcMain.handle('getExpenses', () => {
  return queryAll('SELECT * FROM expenses ORDER BY date DESC, id DESC');
});

// 按大类筛选
ipcMain.handle('getExpensesByMajor', (_event, major) => {
  return queryAll('SELECT * FROM expenses WHERE category_major = ? ORDER BY date DESC, id DESC', [major]);
});

// 删除记录
ipcMain.handle('deleteExpense', (_event, id) => {
  queryRun('DELETE FROM expenses WHERE id = ?', [id]);
  return { success: true };
});

// 更新记录
ipcMain.handle('updateExpense', (_event, expense) => {
  queryRun(
    'UPDATE expenses SET amount = ?, category_major = ?, category_minor = ?, date = ?, note = ? WHERE id = ?',
    [expense.amount, expense.category_major, expense.category_minor, expense.date, expense.note || '', expense.id]
  );
  return { success: true };
});

// 月度统计
ipcMain.handle('getMonthlyStats', (_event, yearMonth) => {
  return queryAll(
    `SELECT category_major, SUM(amount) as total
     FROM expenses WHERE date LIKE ? GROUP BY category_major ORDER BY total DESC`,
    [yearMonth + '%']
  );
});

// ============ 创建主窗口 ============

function createWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 680,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// APP 启动
app.whenReady().then(async () => {
  // 加载 sql.js（它会自动处理 WASM 文件路径）
  const SQL = await initSqlJs();
  await initDatabase(SQL);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
