// main.js — Electron 主进程
// 职责：创建APP窗口、管理数据库、处理来自前端的请求

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');  // Excel 读写库

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
// 将内存中的数据库导出为二进制数据，写入 dbPath 文件
// 每次增删改数据后都要调用一次，不然数据不会持久化
function saveDb() {
  const data = db.export();                    // 导出数据库为二进制
  const buffer = Buffer.from(data);            // 转为 Node.js 可写的 Buffer 格式
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // 目录不存在则创建
  fs.writeFileSync(dbPath, buffer);            // 写入磁盘文件
}

// 初始化数据库：建表、迁移旧数据、写入预设分类
// 参数 SQL 是 sql.js 加载后返回的 SQL 模块对象（里面包含 Database 类），通过 initSqlJs() 获得
async function initDatabase(SQL) {
  // 如果磁盘上已有数据库文件，从磁盘加载
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

  // 数据库迁移：为旧数据库添加 is_preset 字段（如果不存在）
  try {
    db.run('ALTER TABLE categories ADD COLUMN is_preset INTEGER DEFAULT 0');
    // 如果成功添加（说明是旧数据库），将已有分类标记为预设
    db.run('UPDATE categories SET is_preset = 1');
    console.log('数据库迁移：is_preset 字段已添加，已有分类已标记为预设');
  } catch (e) {
    // 字段已存在，无需迁移
  }

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

  // 批量插入，parent_id 中的数字对应上面大类的序号，is_preset=1 表示预设分类
  const stmt = db.prepare(
    'INSERT INTO categories (name, type, parent_id, icon, sort_order, is_preset) VALUES (?, ?, ?, ?, ?, 1)'
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

// 执行写操作（插入/更新/删除），执行后自动保存数据库
function queryRun(sql, params = []) {
  db.run(sql, params);
  saveDb(); // 写操作后立即保存到磁盘，防止数据丢失
}

// ============ IPC 通信处理 ============

// 获取所有分类
ipcMain.handle('getCategories', () => {
  return queryAll('SELECT * FROM categories ORDER BY sort_order');
});

// 添加分类（用户自建）
ipcMain.handle('addCategory', (_event, cat) => {
  // 获取同一类型下的最大排序号
  const parentCondition = cat.parent_id ? `= ${cat.parent_id}` : 'IS NULL';
  const result = queryAll(
    `SELECT MAX(sort_order) as max_sort FROM categories WHERE type = ? AND parent_id ${parentCondition}`,
    [cat.type]
  );
  const sortOrder = (result[0]?.max_sort || 0) + 1;

  queryRun(
    'INSERT INTO categories (name, type, parent_id, icon, sort_order, is_preset) VALUES (?, ?, ?, ?, ?, 0)',
    [cat.name, cat.type, cat.parent_id || null, cat.icon || '', sortOrder]
  );

  // 获取刚插入的分类 ID
  const idResult = queryAll('SELECT last_insert_rowid() as id');
  return { success: true, id: idResult[0]?.id };
});

// 修改分类（仅限用户自建分类）
ipcMain.handle('updateCategory', (_event, cat) => {
  // 查找原分类
  const old = queryAll('SELECT * FROM categories WHERE id = ?', [cat.id])[0];
  if (!old) return { success: false, error: '分类不存在' };
  if (old.is_preset) return { success: false, error: '不能修改预设分类' };

  // 更新分类本身
  queryRun(
    'UPDATE categories SET name = ?, icon = ? WHERE id = ?',
    [cat.name, cat.icon || '', cat.id]
  );

  // 如果名称变了，同步更新 expenses 表中的引用
  if (old.name !== cat.name) {
    if (old.type === 'major') {
      queryRun('UPDATE expenses SET category_major = ? WHERE category_major = ?', [cat.name, old.name]);
    } else {
      queryRun('UPDATE expenses SET category_minor = ? WHERE category_minor = ?', [cat.name, old.name]);
    }
  }

  return { success: true };
});

// 删除分类（仅限用户自建分类，且有支出记录时禁止删除）
ipcMain.handle('deleteCategory', (_event, id) => {
  const cat = queryAll('SELECT * FROM categories WHERE id = ?', [id])[0];
  if (!cat) return { success: false, error: '分类不存在' };
  if (cat.is_preset) return { success: false, error: '不能删除预设分类' };

  if (cat.type === 'major') {
    // 检查是否还有小类
    const minors = queryAll('SELECT COUNT(*) as cnt FROM categories WHERE parent_id = ?', [id]);
    if (minors[0]?.cnt > 0) {
      return { success: false, error: '该大类下还有小类，请先删除所有小类' };
    }
    // 检查是否有支出记录
    const expCount = queryAll('SELECT COUNT(*) as cnt FROM expenses WHERE category_major = ?', [cat.name]);
    if (expCount[0]?.cnt > 0) {
      return { success: false, error: `有 ${expCount[0].cnt} 条支出记录使用了该分类，请先清理记录` };
    }
  } else {
    // 小类：检查是否有支出记录
    const expCount = queryAll('SELECT COUNT(*) as cnt FROM expenses WHERE category_minor = ?', [cat.name]);
    if (expCount[0]?.cnt > 0) {
      return { success: false, error: `有 ${expCount[0].cnt} 条支出记录使用了该分类，请先清理记录` };
    }
  }

  queryRun('DELETE FROM categories WHERE id = ?', [id]);
  return { success: true };
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

// ============ Excel 导入导出 ============

// 导出所有支出记录为 Excel 文件
ipcMain.handle('exportExpenses', async () => {
  // 从数据库读取所有支出记录
  const expenses = queryAll('SELECT * FROM expenses ORDER BY date DESC, id DESC');
  if (expenses.length === 0) {
    return { success: false, error: '没有支出记录可导出' };
  }

  // 弹出保存文件对话框
  const result = await dialog.showSaveDialog({
    title: '导出支出记录',
    defaultPath: `记账数据_${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [
      { name: 'Excel 文件', extensions: ['xlsx'] },
      { name: 'CSV 文件', extensions: ['csv'] },
    ],
  });

  if (result.canceled) return { success: false, error: '已取消' };

  try {
    // 准备好写的数据（把数据库字段转成中文表头）
    const rows = expenses.map(e => ({
      '日期': e.date,
      '大类': e.category_major,
      '小类': e.category_minor,
      '金额(元)': e.amount,
      '备注': e.note || '',
      '记录时间': e.created_at || '',
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    // 设置列宽
    sheet['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, '支出记录');

    // 写入文件
    const filePath = result.filePath;
    if (filePath.endsWith('.csv')) {
      XLSX.writeFile(workbook, filePath, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, filePath);
    }

    return { success: true, path: filePath, count: expenses.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 从 Excel 文件导入支出记录
ipcMain.handle('importExpenses', async () => {
  // 弹出打开文件对话框
  const result = await dialog.showOpenDialog({
    title: '导入支出记录',
    filters: [
      { name: 'Excel/CSV 文件', extensions: ['xlsx', 'xls', 'csv'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: '已取消' };
  }

  const filePath = result.filePaths[0];

  try {
    // 读取 Excel 文件
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];  // 取第一个工作表
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return { success: false, error: '文件中没有数据' };
    }

    // 支持中英文表头
    let imported = 0;
    const stmt = db.prepare(
      'INSERT INTO expenses (amount, category_major, category_minor, date, note) VALUES (?, ?, ?, ?, ?)'
    );

    for (const row of rows) {
      // 兼容中英文列名
      const date = row['日期'] || row['date'] || '';
      const major = row['大类'] || row['category_major'] || '';
      const minor = row['小类'] || row['category_minor'] || '';
      const amount = parseFloat(row['金额(元)'] || row['amount'] || 0);
      const note = row['备注'] || row['note'] || '';

      // 数据校验：日期和金额必须有
      if (!date || isNaN(amount) || amount <= 0 || !major || !minor) {
        continue;  // 跳过无效行
      }

      stmt.run([amount, major, minor, date, note]);
      imported++;
    }
    stmt.free();

    if (imported === 0) {
      return { success: false, error: '没有有效的记录可导入，请检查文件格式' };
    }

    saveDb();
    return { success: true, count: imported, total: rows.length };
  } catch (err) {
    return { success: false, error: '文件读取失败：' + err.message };
  }
});

// ============ 创建主窗口 ============

function createWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 820,
    minWidth: 400,
    minHeight: 600,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 隔离网页和主进程的 JS 上下文，防止网页直接访问 Node.js
      nodeIntegration: false,   // 禁止网页里使用 require()
      sandbox: true,            // 操作系统级沙箱，额外一层安全防护
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
