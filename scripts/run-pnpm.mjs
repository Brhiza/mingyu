import { spawnSync } from 'node:child_process';

/** 保留当前 pnpm 入口：JS 由当前 Node 启动，原生启动器直接执行。 */
export function runPnpm(args, cwd, extraEnv = {}) {
  const entry = process.env.npm_execpath || (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm');
  const isJavaScript = /\.[cm]?js$/i.test(entry);
  const command = isJavaScript ? process.execPath : entry;
  const commandArgs = isJavaScript ? [entry, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(command),
  });
  if (result.error || result.status !== 0) {
    const output = [result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n')
      .trim();
    throw new Error(
      `${command} ${args.join(' ')} 执行失败${result.signal ? `（${result.signal}）` : ''}。\n${output}`,
    );
  }
  return result.stdout.trim();
}
