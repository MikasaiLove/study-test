// start-launcher.js — 修复 VS Code 的 ELECTRON_RUN_AS_NODE 问题后启动 Electron
// 问题：VS Code 终端设置了 ELECTRON_RUN_AS_NODE=1，导致 Electron 被当作纯 Node.js 运行
// 修复：清除该环境变量后启动 Electron

const { spawn } = require('child_process');
const path = require('path');

// 清除导致问题的环境变量
delete process.env.ELECTRON_RUN_AS_NODE;

const electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');

console.log('🚀 启动个人记账 APP...');
const child = spawn(electronPath, ['.'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env, // 使用清除了 ELECTRON_RUN_AS_NODE 的环境
});

child.on('close', (code) => {
  console.log('APP 已退出 (code: ' + code + ')');
  process.exit(code);
});
