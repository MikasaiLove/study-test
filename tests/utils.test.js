// tests/utils.test.js — 纯工具函数的单元测试
// 对应的源码：renderer/utils.js

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ 加载真实源码 ============

// 创建 jsdom 环境
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  runScripts: 'dangerously', // 允许执行脚本
});
global.window = dom.window;
global.document = dom.window.document;

// 用 vm 模块在 jsdom window 上下文里执行源码，函数会挂到 window 上
const utilsPath = path.resolve(__dirname, '..', 'renderer', 'utils.js');
const utilsCode = fs.readFileSync(utilsPath, 'utf-8');
const context = vm.createContext(dom.window);
const script = new vm.Script(utilsCode);
script.runInContext(context);

// 从 window 上取函数引用
const todayStr = dom.window.todayStr;
const currentYearMonth = dom.window.currentYearMonth;
const formatDate = dom.window.formatDate;
const getWeekDay = dom.window.getWeekDay;
const processCategories = dom.window.processCategories;
const calcDayTotal = dom.window.calcDayTotal;

// ============ 测试用例 ============

describe('todayStr — 获取今天日期字符串', () => {
  it('格式应为 YYYY-MM-DD', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('currentYearMonth — 获取当前年月', () => {
  it('格式应为 YYYY-MM', () => {
    expect(currentYearMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('formatDate — 格式化日期显示', () => {
  it('7月2日 → 周四（2026年）', () => {
    expect(formatDate('2026-07-02')).toBe('7月2日 周四');
  });

  it('1月1日', () => {
    expect(formatDate('2026-01-01')).toBe('1月1日 周四');
  });

  it('12月31日', () => {
    expect(formatDate('2026-12-31')).toBe('12月31日 周四');
  });

  it('跨月边界：7月1日', () => {
    expect(formatDate('2026-07-01')).toBe('7月1日 周三');
  });
});

describe('getWeekDay — 获取中文星期', () => {
  const cases = [
    ['2026-07-05', '周日'],
    ['2026-07-06', '周一'],
    ['2026-07-07', '周二'],
    ['2026-07-08', '周三'],
    ['2026-07-09', '周四'],
    ['2026-07-10', '周五'],
    ['2026-07-11', '周六'],
  ];

  cases.forEach(([date, expected]) => {
    it(`${date} → ${expected}`, () => {
      expect(getWeekDay(date)).toBe(expected);
    });
  });
});

describe('processCategories — 处理分类数据', () => {
  it('正确拆分大类和小类', () => {
    const input = [
      { id: 1, name: '餐饮', type: 'major', icon: '🍜', parent_id: null },
      { id: 2, name: '早餐', type: 'minor', icon: '', parent_id: 1 },
      { id: 3, name: '午餐', type: 'minor', icon: '', parent_id: 1 },
      { id: 4, name: '交通', type: 'major', icon: '🚗', parent_id: null },
      { id: 5, name: '公交', type: 'minor', icon: '', parent_id: 4 },
    ];

    const result = processCategories(input);

    expect(result.majorCategories).toHaveLength(2);
    expect(result.majorCategories[0].name).toBe('餐饮');
    expect(result.majorCategories[1].name).toBe('交通');

    expect(result.minorMap['餐饮']).toHaveLength(2);
    expect(result.minorMap['餐饮'][0].name).toBe('早餐');
    expect(result.minorMap['餐饮'][1].name).toBe('午餐');
    expect(result.minorMap['交通']).toHaveLength(1);
    expect(result.minorMap['交通'][0].name).toBe('公交');
  });

  it('没有小类的分类，minorMap 为空数组', () => {
    const input = [
      { id: 1, name: '餐饮', type: 'major', icon: '🍜', parent_id: null },
    ];
    const result = processCategories(input);
    expect(result.majorCategories).toHaveLength(1);
    expect(result.minorMap['餐饮']).toEqual([]);
  });

  it('空数组输入返回空结果', () => {
    const result = processCategories([]);
    expect(result.majorCategories).toEqual([]);
    expect(result.minorMap).toEqual({});
  });

  it('大类之间的小类不混', () => {
    const input = [
      { id: 1, name: 'A', type: 'major', icon: '', parent_id: null },
      { id: 2, name: 'a1', type: 'minor', icon: '', parent_id: 1 },
      { id: 3, name: 'B', type: 'major', icon: '', parent_id: null },
      { id: 4, name: 'b1', type: 'minor', icon: '', parent_id: 3 },
    ];
    const result = processCategories(input);
    expect(result.minorMap['A']).toHaveLength(1);
    expect(result.minorMap['B']).toHaveLength(1);
  });
});

describe('calcDayTotal — 计算某一天合计', () => {
  const expenses = [
    { id: 1, amount: 25.5, date: '2026-07-01', category_major: '餐饮' },
    { id: 2, amount: 9.9, date: '2026-07-01', category_major: '交通' },
    { id: 3, amount: 100, date: '2026-07-02', category_major: '购物' },
  ];

  it('同一天多条记录正确合计', () => {
    expect(calcDayTotal('2026-07-01', expenses)).toBe('合计: ¥35.40');
  });

  it('单条记录正确合计', () => {
    expect(calcDayTotal('2026-07-02', expenses)).toBe('合计: ¥100.00');
  });

  it('没有记录的日期合计为 0', () => {
    expect(calcDayTotal('2026-12-25', expenses)).toBe('合计: ¥0.00');
  });

  it('空列表合计为 0', () => {
    expect(calcDayTotal('2026-07-01', [])).toBe('合计: ¥0.00');
  });
});
