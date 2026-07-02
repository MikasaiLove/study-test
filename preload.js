// preload.js — 安全桥接脚本
// 前端通过这个桥来安全地调用后端功能（比如读写数据库）
// 前端不能直接访问 Node.js 或文件系统，只能通过这里暴露的方法

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ====== 分类相关 ======
  getCategories: () => ipcRenderer.invoke('getCategories'),
  addCategory: (cat) => ipcRenderer.invoke('addCategory', cat),
  updateCategory: (cat) => ipcRenderer.invoke('updateCategory', cat),
  deleteCategory: (id) => ipcRenderer.invoke('deleteCategory', id),

  // ====== 支出记录相关 ======
  addExpense: (expense) => ipcRenderer.invoke('addExpense', expense),
  getExpenses: () => ipcRenderer.invoke('getExpenses'),
  getExpensesByMajor: (major) => ipcRenderer.invoke('getExpensesByMajor', major),
  deleteExpense: (id) => ipcRenderer.invoke('deleteExpense', id),
  updateExpense: (expense) => ipcRenderer.invoke('updateExpense', expense),

  // ====== 统计相关 ======
  getMonthlyStats: (yearMonth) => ipcRenderer.invoke('getMonthlyStats', yearMonth),
});
