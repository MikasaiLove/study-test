// utils.js — 纯工具函数（不依赖 DOM 和 IPC）
// 这些函数从 app.js 中提取出来，方便单元测试

// 获取今天的日期字符串 YYYY-MM-DD
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// 获取当前年月字符串 YYYY-MM
function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// 格式化日期为"X月X日 周X"的格式
function formatDate(dateStr) {
  const parts = dateStr.split('-');
  const weekDay = getWeekDay(dateStr);
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日 ${weekDay}`;
}

// 获取中文星期几
function getWeekDay(dateStr) {
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

// 处理分类数据：将大类和小类分开
// 输入：所有分类数组
// 输出：{ majorCategories, minorMap }
function processCategories(cats) {
  const majorCategories = cats.filter(c => c.type === 'major');
  const minorMap = {};
  majorCategories.forEach(major => {
    minorMap[major.name] = cats.filter(
      c => c.type === 'minor' && c.parent_id === major.id
    );
  });
  return { majorCategories, minorMap };
}

// 根据支出记录和当前筛选大类，计算某一天的合计金额
// 输入：日期字符串、所有支出记录、筛选条件
// 输出：格式化后的合计字符串
function calcDayTotal(date, expenses) {
  const total = expenses
    .filter(e => e.date === date)
    .reduce((sum, e) => sum + e.amount, 0);
  return `合计: ¥${total.toFixed(2)}`;
}
