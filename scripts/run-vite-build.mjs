import { spawnSync } from 'child_process';
import path from 'path';

const isServer = process.argv.includes('--server');
const args = isServer ? ['build', '--config', 'vite.server.config.ts'] : ['build'];

const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js');

const result = spawnSync(process.execPath, ['--max-old-space-size=4096', viteBin, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=4096',
  },
});

if (result.error) {
  console.error(`Vite 构建进程启动失败：${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`Vite 构建被信号 ${result.signal} 终止。`);
  process.exit(1);
}
process.exit(result.status ?? 1);
