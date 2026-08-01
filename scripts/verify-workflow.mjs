import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function getPnpmInvocation() {
  if (process.platform !== 'win32') {
    return { command: 'pnpm', prefixArgs: [] };
  }

  const pathDirectories = (process.env.PATH || '').split(delimiter).filter(Boolean);
  for (const directory of pathDirectories) {
    for (const relativePath of [
      'node_modules/corepack/dist/pnpm.js',
      'node_modules/pnpm/bin/pnpm.cjs',
    ]) {
      const cliPath = join(directory, relativePath);
      if (existsSync(cliPath)) {
        return { command: process.execPath, prefixArgs: [cliPath] };
      }
    }
  }

  return {
    command: 'powershell.exe',
    prefixArgs: [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '& pnpm @args',
    ],
  };
}

const pnpmInvocation = getPnpmInvocation();

function fail(message) {
  console.error(`\n校验失败：${message}`);
  process.exit(1);
}

function run(label, command, args) {
  console.log(`\n▶ ${label}`);
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    fail(`${label} 无法启动：${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${label} 未通过（退出码 ${result.status ?? '未知'}）`);
  }

  console.log(`✓ ${label}（${((Date.now() - startedAt) / 1000).toFixed(1)} 秒）`);
}

function runPnpm(label, args) {
  run(label, pnpmInvocation.command, [...pnpmInvocation.prefixArgs, ...args]);
}

function captureGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error || result.status !== 0) {
    fail(`无法读取 Git 改动：${result.stderr?.trim() || result.error?.message || '未知错误'}`);
  }

  return result.stdout.split('\0').filter(Boolean);
}

function getChangedFiles() {
  return [
    ...new Set([
      ...captureGit(['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD', '--']),
      ...captureGit(['ls-files', '--others', '--exclude-standard', '-z']),
    ]),
  ].filter((file) => existsSync(resolve(repoRoot, file)));
}

function runQuick(args) {
  let skipBuild = false;
  let namePattern;
  const testFiles = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--skip-build') {
      skipBuild = true;
      continue;
    }
    if (argument === '--name-pattern') {
      namePattern = args[index + 1];
      if (!namePattern) {
        fail('--name-pattern 后必须提供测试名称');
      }
      index += 1;
      continue;
    }
    if (argument.startsWith('--name-pattern=')) {
      namePattern = argument.slice('--name-pattern='.length);
      if (!namePattern) {
        fail('--name-pattern 后必须提供测试名称');
      }
      continue;
    }
    if (argument.startsWith('--')) {
      fail(`不支持的参数：${argument}`);
    }
    testFiles.push(argument);
  }

  if (testFiles.length === 0) {
    fail('快速校验必须指定至少一个相关测试文件，避免产生“已经验证”的假象');
  }

  const missingFiles = testFiles.filter((file) => !existsSync(resolve(repoRoot, file)));
  if (missingFiles.length > 0) {
    fail(`测试文件不存在：${missingFiles.join('、')}`);
  }

  if (!skipBuild) {
    runPnpm('构建 mingyu-core', ['--filter', 'mingyu-core', 'build']);
  }

  const testArgs = ['exec', 'tsx', '--tsconfig', 'tsconfig.app.json', '--test'];
  if (namePattern) {
    testArgs.push('--test-name-pattern', namePattern);
  }
  testArgs.push(...testFiles);
  runPnpm(`运行 ${testFiles.length} 个相关测试文件`, testArgs);

  const changedFiles = getChangedFiles();
  const prettierFiles = changedFiles.filter((file) =>
    /\.(?:[cm]?[jt]sx?|json|md|ya?ml|css|scss|html)$/.test(file),
  );
  if (prettierFiles.length > 0) {
    runPnpm(`检查 ${prettierFiles.length} 个本次改动文件的格式`, [
      'exec',
      'prettier',
      '--check',
      ...prettierFiles,
    ]);
  } else {
    console.log('\n✓ 本次没有需要 Prettier 检查的改动文件');
  }

  const eslintFiles = changedFiles.filter((file) =>
    /^(?:src|packages\/core\/src)\/.*\.tsx?$/.test(file),
  );
  if (eslintFiles.length > 0) {
    runPnpm(`检查 ${eslintFiles.length} 个本次改动源码文件`, [
      'exec',
      'eslint',
      ...eslintFiles,
      '--max-warnings',
      '999',
    ]);
  } else {
    console.log('\n✓ 本次没有需要 ESLint 检查的源码文件');
  }

  run('检查 Git 差异', 'git', ['diff', '--check']);
  console.log('\n✅ 快速校验全部通过');
}

function runFull() {
  const steps = [
    ['主测试（含一次核心构建）', ['test']],
    ['TypeScript 类型检查', ['run', 'type-check']],
    ['MCP 结构化输出测试', ['run', 'test:e2e']],
    ['生成提示词审查样本', ['run', 'prompt:audit']],
    ['构建前端应用', ['run', 'build:app']],
    ['检查全部源码', ['run', 'lint']],
    ['检查全部文件格式', ['run', 'format:check']],
  ];

  for (const [label, args] of steps) {
    runPnpm(label, args);
  }
  run('检查 Git 差异', 'git', ['diff', '--check']);
  console.log('\n✅ 完整校验全部通过');
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'quick') {
  runQuick(args);
} else if (mode === 'full') {
  if (args.length > 0) {
    fail(`完整校验不接受额外参数：${args.join(' ')}`);
  }
  runFull();
} else {
  fail('请使用 quick 或 full 模式');
}
