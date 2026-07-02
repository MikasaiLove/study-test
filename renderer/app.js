// app.js — 前端主逻辑
// 负责：界面交互、数据展示、调用后端API

// ============ 全局状态 ============
let allCategories = [];      // 所有分类
let majorCategories = [];    // 大类列表
let minorMap = {};           // { 大类名: [小类列表] }
let currentFilter = '全部';  // 当前选中的筛选分类
let allExpenses = [];        // 当前显示的支出记录
let pieChartInstance = null; // Chart.js 饼图实例

// ============ 初始化 ============
async function init() {
  // 设置默认日期为今天
  document.getElementById('inputDate').value = todayStr();

  // 加载分类数据
  const cats = await window.electronAPI.getCategories();
  processCategories(cats);

  // 加载支出记录
  await loadExpenses();

  // 渲染分类筛选标签
  renderFilterTabs();

  // 更新本月支出总额
  await updateMonthlyTotal();

  // 绑定事件
  bindEvents();
}

// 处理分类数据：把大类和小类分开
function processCategories(cats) {
  allCategories = cats;
  majorCategories = cats.filter(c => c.type === 'major');
  minorMap = {};
  majorCategories.forEach(major => {
    minorMap[major.name] = cats.filter(
      c => c.type === 'minor' && c.parent_id === major.id
    );
  });
}

// ============ 日期工具 ============
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ============ 加载支出记录 ============
async function loadExpenses() {
  if (currentFilter === '全部') {
    allExpenses = await window.electronAPI.getExpenses();
  } else {
    allExpenses = await window.electronAPI.getExpensesByMajor(currentFilter);
  }
  renderExpenseList();
}

// ============ 渲染支出列表 ============
function renderExpenseList() {
  const listEl = document.getElementById('expenseList');
  const emptyEl = document.getElementById('emptyState');

  if (allExpenses.length === 0) {
    // 显示空状态
    listEl.innerHTML = '';
    listEl.appendChild(createEmptyState());
    return;
  }

  // 按日期分组（已经按日期倒序排列）
  let html = '';
  let lastDate = '';

  allExpenses.forEach(exp => {
    // 日期分隔线（同一天的多条记录显示一个日期头）
    if (exp.date !== lastDate) {
      html += `<div class="date-header">
        <span>${formatDate(exp.date)}</span>
        <span class="date-total">${calcDayTotal(exp.date)}</span>
      </div>`;
      lastDate = exp.date;
    }

    // 找到该支出对应的图标
    const icon = getIconForExpense(exp);

    html += `
      <div class="expense-item" data-id="${exp.id}" title="点击编辑">
        <div class="expense-icon">${icon}</div>
        <div class="expense-info">
          <div class="info-row1">
            <span class="minor-tag">${exp.category_minor}</span>
            <span class="major-tag">${exp.category_major}</span>
          </div>
          <div class="info-row2">
            <span class="expense-note">${exp.note || '无备注'}</span>
          </div>
        </div>
        <span class="expense-amount">-¥${exp.amount.toFixed(2)}</span>
      </div>`;
  });

  listEl.innerHTML = html;

  // 给每条记录绑定点击事件（编辑）和右键事件（删除）
  listEl.querySelectorAll('.expense-item').forEach(item => {
    item.addEventListener('click', () => openEditModal(item.dataset.id));
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, item.dataset.id);
    });
  });
}

// 创建空状态元素
function createEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.id = 'emptyState';
  div.innerHTML = `
    <div class="empty-icon">📝</div>
    <div class="empty-text">还没有记录</div>
    <div class="empty-hint">点击「记一笔」开始记账吧</div>
  `;
  return div;
}

// 获取支出对应的图标（从小类找大类图标）
function getIconForExpense(exp) {
  const major = majorCategories.find(m => m.name === exp.category_major);
  return major ? major.icon : '💰';
}

// 计算某一天的支出合计
function calcDayTotal(date) {
  const total = allExpenses
    .filter(e => e.date === date)
    .reduce((sum, e) => sum + e.amount, 0);
  return `合计: ¥${total.toFixed(2)}`;
}

// 格式化日期显示
function formatDate(dateStr) {
  const parts = dateStr.split('-');
  const weekDay = getWeekDay(dateStr);
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日 ${weekDay}`;
}

function getWeekDay(dateStr) {
  const days = ['周日','周一','周二','周三','周四','周五','周六'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

// ============ 渲染分类筛选标签 ============
function renderFilterTabs() {
  const bar = document.getElementById('filterBar');
  let html = `<div class="filter-tag ${currentFilter === '全部' ? 'active' : ''}" data-filter="全部">全部</div>`;
  majorCategories.forEach(major => {
    html += `<div class="filter-tag ${currentFilter === major.name ? 'active' : ''}" data-filter="${major.name}">
      ${major.icon} ${major.name}
    </div>`;
  });
  bar.innerHTML = html;

  // 绑定点击事件
  bar.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', async () => {
      currentFilter = tag.dataset.filter;
      renderFilterTabs();  // 重新渲染，更新激活状态
      await loadExpenses();
      await updateMonthlyTotal();
    });
  });
}

// ============ 打开"记一笔"弹窗 ============
function openAddModal() {
  document.getElementById('modalTitle').textContent = '记一笔';
  document.getElementById('editId').value = '';
  document.getElementById('inputAmount').value = '';
  document.getElementById('inputDate').value = todayStr();
  document.getElementById('inputNote').value = '';
  document.getElementById('selectMinor').innerHTML = '<option value="">请先选择大类</option>';
  document.getElementById('modalOverlay').style.display = 'flex';

  // 渲染大类选择器
  renderMajorGrid();
  // 取消所有大类的选中状态
  document.querySelectorAll('.cat-major-option').forEach(el => el.classList.remove('selected'));

  document.getElementById('inputAmount').focus();
}

// 打开编辑弹窗（点击已有记录）
async function openEditModal(id) {
  const exp = allExpenses.find(e => e.id === parseInt(id));
  if (!exp) return;

  document.getElementById('modalTitle').textContent = '编辑记录';
  document.getElementById('editId').value = exp.id;
  document.getElementById('inputAmount').value = exp.amount;
  document.getElementById('inputDate').value = exp.date;
  document.getElementById('inputNote').value = exp.note || '';

  // 渲染大类选择器并选中
  renderMajorGrid();
  document.querySelectorAll('.cat-major-option').forEach(el => {
    if (el.dataset.major === exp.category_major) {
      el.classList.add('selected');
    }
  });

  // 加载对应的小类并选中
  populateMinors(exp.category_major);
  document.getElementById('selectMinor').value = exp.category_minor;

  document.getElementById('modalOverlay').style.display = 'flex';
}

// 关闭弹窗
function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

// ============ 渲染大类网格 ============
function renderMajorGrid() {
  const grid = document.getElementById('majorGrid');
  let html = '';
  majorCategories.forEach(major => {
    html += `<div class="cat-major-option" data-major="${major.name}">
      ${major.icon} ${major.name}
    </div>`;
  });
  grid.innerHTML = html;

  // 绑定点击事件：点击大类后加载对应小类
  grid.querySelectorAll('.cat-major-option').forEach(el => {
    el.addEventListener('click', () => {
      grid.querySelectorAll('.cat-major-option').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      populateMinors(el.dataset.major);
    });
  });
}

// 填充小类下拉框
function populateMinors(majorName) {
  const select = document.getElementById('selectMinor');
  const minors = minorMap[majorName] || [];
  let html = '<option value="">请选择小类</option>';
  minors.forEach(m => {
    html += `<option value="${m.name}">${m.name}</option>`;
  });
  select.innerHTML = html;
}

// ============ 保存支出记录 ============
async function saveExpense() {
  const amount = parseFloat(document.getElementById('inputAmount').value);
  const date = document.getElementById('inputDate').value;
  const note = document.getElementById('inputNote').value;
  const selectMinor = document.getElementById('selectMinor');
  const categoryMinor = selectMinor.value;
  const editId = document.getElementById('editId').value;

  // 表单验证
  if (!amount || amount <= 0) {
    alert('请输入有效的金额');
    return;
  }

  // 找到当前选中大类
  const selectedMajor = document.querySelector('.cat-major-option.selected');
  if (!selectedMajor) {
    alert('请选择支出大类');
    return;
  }
  const categoryMajor = selectedMajor.dataset.major;

  if (!categoryMinor) {
    alert('请选择支出小类');
    return;
  }

  if (!date) {
    alert('请选择日期');
    return;
  }

  const expense = {
    amount,
    category_major: categoryMajor,
    category_minor: categoryMinor,
    date,
    note,
  };

  if (editId) {
    // 编辑模式
    expense.id = parseInt(editId);
    await window.electronAPI.updateExpense(expense);
  } else {
    // 新增模式
    await window.electronAPI.addExpense(expense);
  }

  // 关闭弹窗，刷新列表
  closeModal();
  await loadExpenses();
  await updateMonthlyTotal();
}

// ============ 删除记录 ============
async function deleteExpense(id) {
  if (!confirm('确定要删除这条记录吗？此操作不可撤销。')) return;
  await window.electronAPI.deleteExpense(parseInt(id));
  await loadExpenses();
  await updateMonthlyTotal();
}

// ============ 右键菜单 ============
function showContextMenu(x, y, id) {
  // 移除已有菜单
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.innerHTML = `
    <div class="context-menu-item" data-action="edit">✏️ 编辑</div>
    <div class="context-menu-item danger" data-action="delete">🗑️ 删除</div>
  `;

  menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    menu.remove();
    openEditModal(id);
  });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    menu.remove();
    deleteExpense(id);
  });

  document.body.appendChild(menu);

  // 点击其他地方关闭菜单
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    });
  }, 0);
}

// ============ 更新本月总支出 ============
async function updateMonthlyTotal() {
  const stats = await window.electronAPI.getMonthlyStats(currentYearMonth());
  const total = stats.reduce((sum, s) => sum + s.total, 0);
  document.getElementById('totalAmount').textContent = `¥${total.toFixed(2)}`;

  // 更新月份显示
  const d = new Date();
  document.getElementById('headerMonth').textContent =
    `${d.getFullYear()}年${d.getMonth()+1}月`;
}

// ============ 分类管理 ============
let editingCatId = null; // 当前正在编辑的分类 ID（null = 新增模式）

// 打开分类管理弹窗
function openCatManager() {
  document.getElementById('catOverlay').style.display = 'flex';
  resetCatForm();
  renderCatList();
}

// 关闭分类管理弹窗
function closeCatManager() {
  document.getElementById('catOverlay').style.display = 'none';
}

// 重置新增表单
function resetCatForm() {
  editingCatId = null;
  document.getElementById('catAddType').value = 'minor';
  document.getElementById('catAddName').value = '';
  document.getElementById('catAddIcon').value = '';
  document.getElementById('btnCatAdd').textContent = '添加';
  handleCatTypeChange(); // 刷新大类选择器和显示状态
}

// 大类/小类切换时，显示或隐藏父级大类选择器
function handleCatTypeChange() {
  const type = document.getElementById('catAddType').value;
  const parentSelect = document.getElementById('catAddParent');
  if (type === 'minor') {
    parentSelect.style.display = '';
    // 填充大类选项
    let html = '';
    majorCategories.forEach(m => {
      html += `<option value="${m.id}">${m.icon} ${m.name}</option>`;
    });
    parentSelect.innerHTML = html;
  } else {
    parentSelect.style.display = 'none';
  }
}

// 渲染分类列表
function renderCatList() {
  const listEl = document.getElementById('catList');
  let html = '';

  majorCategories.forEach(major => {
    const minors = minorMap[major.name] || [];
    html += renderCatRow(major, true);

    minors.forEach(minor => {
      html += renderCatRow(minor, false);
    });
  });

  listEl.innerHTML = html;

  // 绑定编辑/删除按钮事件
  listEl.querySelectorAll('.cat-btn-edit').forEach(btn => {
    btn.addEventListener('click', () => startEditCat(parseInt(btn.dataset.id)));
  });
  listEl.querySelectorAll('.cat-btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteCat(parseInt(btn.dataset.id)));
  });
}

// 渲染单条分类行
function renderCatRow(cat, isMajor) {
  const isPreset = cat.is_preset === 1;
  const rowClass = isMajor ? 'cat-list-item major-item' : 'cat-list-item minor-item';
  const indent = isMajor ? '' : '└ ';

  let actionsHtml = '';
  if (isPreset) {
    actionsHtml = `<span class="cat-item-badge">🔒 预设</span>`;
  } else {
    actionsHtml = `
      <div class="cat-item-actions">
        <button class="cat-btn-edit" data-id="${cat.id}" title="编辑">✏️</button>
        <button class="cat-btn-delete" data-id="${cat.id}" title="删除">🗑️</button>
      </div>`;
  }

  return `
    <div class="${rowClass}">
      <span class="cat-item-icon">${cat.icon || '📁'}</span>
      <span class="cat-item-name">${indent}${cat.name}</span>
      ${actionsHtml}
    </div>`;
}

// 开始编辑分类（填充表单）
function startEditCat(id) {
  const cat = allCategories.find(c => c.id === id);
  if (!cat || cat.is_preset) return;

  editingCatId = id;
  document.getElementById('catAddType').value = cat.type;
  document.getElementById('catAddName').value = cat.name;
  document.getElementById('catAddIcon').value = cat.icon || '';
  document.getElementById('btnCatAdd').textContent = '保存修改';
  handleCatTypeChange();

  // 如果是小类，选中对应的大类
  if (cat.type === 'minor' && cat.parent_id) {
    document.getElementById('catAddParent').value = cat.parent_id;
  }

  // 滚动到表单顶部
  document.getElementById('catBody').scrollTop = 0;
  document.getElementById('catAddName').focus();
}

// 添加或更新分类
async function handleAddOrUpdateCat() {
  const name = document.getElementById('catAddName').value.trim();
  const icon = document.getElementById('catAddIcon').value.trim();
  const type = document.getElementById('catAddType').value;

  if (!name) {
    alert('请输入分类名称');
    return;
  }

  if (editingCatId) {
    // 编辑模式
    const result = await window.electronAPI.updateCategory({
      id: editingCatId,
      name,
      icon,
    });
    if (!result.success) {
      alert(result.error);
      return;
    }
  } else {
    // 新增模式
    const parentId = type === 'minor' ? parseInt(document.getElementById('catAddParent').value) : null;
    const result = await window.electronAPI.addCategory({
      name,
      type,
      parent_id: parentId,
      icon,
    });
    if (!result.success) {
      alert(result.error);
      return;
    }
  }

  // 刷新分类数据
  const cats = await window.electronAPI.getCategories();
  processCategories(cats);
  renderFilterTabs();
  renderCatList();
  resetCatForm();
}

// 删除分类
async function deleteCat(id) {
  const cat = allCategories.find(c => c.id === id);
  if (!cat || cat.is_preset) return;

  if (!confirm(`确定要删除分类「${cat.name}」吗？\n\n（只能删除没有支出记录的分类）`)) return;

  const result = await window.electronAPI.deleteCategory(id);
  if (!result.success) {
    alert(result.error);
    return;
  }

  // 刷新分类数据
  const cats = await window.electronAPI.getCategories();
  processCategories(cats);
  renderFilterTabs();
  renderCatList();

  // 如果正在编辑的分类被删除了，重置表单
  if (editingCatId === id) {
    resetCatForm();
  }
}

// ============ 月度统计 ============
async function openStats() {
  const statsOverlay = document.getElementById('statsOverlay');
  statsOverlay.style.display = 'flex';

  // 设置默认月份为当前月
  document.getElementById('statsMonth').value = currentYearMonth();

  // 加载统计
  await loadStats(currentYearMonth());

  // 月份切换事件
  document.getElementById('statsMonth').addEventListener('change', async (e) => {
    await loadStats(e.target.value);
  });
}

function closeStats() {
  document.getElementById('statsOverlay').style.display = 'none';
}

async function loadStats(yearMonth) {
  const stats = await window.electronAPI.getMonthlyStats(yearMonth);

  // 渲染统计列表
  const listEl = document.getElementById('statsList');
  if (stats.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">该月没有支出记录</div>';
  } else {
    const colors = [
      '#4a90d9','#f5a623','#7ed321','#50e3c2','#b8e986',
      '#bd10e0','#9013fe','#4a4a4a','#9b9b9b','#d0021b'
    ];
    const totalAll = stats.reduce((sum, s) => sum + s.total, 0);
    let html = '';
    stats.forEach((s, i) => {
      const pct = ((s.total / totalAll) * 100).toFixed(1);
      html += `
        <div class="stats-item">
          <div class="stats-item-left">
            <span class="stats-dot" style="background:${colors[i % colors.length]}"></span>
            <span class="stats-name">${s.category_major}</span>
            <span style="color:#999;font-size:12px;">${pct}%</span>
          </div>
          <span class="stats-total">¥${s.total.toFixed(2)}</span>
        </div>`;
    });
    listEl.innerHTML = html;
  }

  // 渲染饼图
  renderPieChart(stats, yearMonth);
}

function renderPieChart(stats, yearMonth) {
  // 销毁旧图表
  if (pieChartInstance) {
    pieChartInstance.destroy();
  }

  const ctx = document.getElementById('pieChart').getContext('2d');

  if (stats.length === 0) {
    // 没有数据时画一个灰色圆环
    pieChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['暂无数据'],
        datasets: [{
          data: [1],
          backgroundColor: ['#e8ecf1'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
      },
    });
    return;
  }

  const colors = [
    '#4a90d9','#f5a623','#7ed321','#50e3c2','#b8e986',
    '#bd10e0','#9013fe','#4a4a4a','#9b9b9b','#d0021b'
  ];

  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: stats.map(s => s.category_major),
      datasets: [{
        data: stats.map(s => s.total),
        backgroundColor: stats.map((_, i) => colors[i % colors.length]),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ¥${ctx.parsed.toFixed(2)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ============ 事件绑定 ============
function bindEvents() {
  // 记一笔按钮
  document.getElementById('btnAdd').addEventListener('click', openAddModal);
  // 关闭弹窗
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('btnCancel').addEventListener('click', closeModal);
  // 保存
  document.getElementById('btnSave').addEventListener('click', saveExpense);
  // 点击弹窗背景关闭
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  // 回车保存
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('modalOverlay').style.display === 'flex') {
      saveExpense();
    }
  });

  // 分类管理
  document.getElementById('btnCategory').addEventListener('click', openCatManager);
  document.getElementById('catClose').addEventListener('click', closeCatManager);
  document.getElementById('catOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'catOverlay') closeCatManager();
  });
  document.getElementById('catAddType').addEventListener('change', handleCatTypeChange);
  document.getElementById('btnCatAdd').addEventListener('click', handleAddOrUpdateCat);

  // 月度统计
  document.getElementById('btnStats').addEventListener('click', openStats);
  document.getElementById('statsClose').addEventListener('click', closeStats);
  document.getElementById('statsOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'statsOverlay') closeStats();
  });
}

// ============ 启动应用 ============
init();
