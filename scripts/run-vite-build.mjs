import { spawnSync } from 'child_process';
import path from 'path';

const isServer = process.argv.includes('--server');
const args = isServer
  ? ['build', '--config', 'vite.server.config.ts']
  : ['build'];

const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js');

const result = spawnSync(process.execPath, ['--max-old-space-size=4096', viteBin, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=4096',
  },
});

process.exit(result.status ?? 0);

