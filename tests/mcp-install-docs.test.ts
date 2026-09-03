import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('MCP 安装与快速开始文档契约应优先推荐 npx 且源码开发遵循 pnpm 规范', () => {
  const mcpReadme = readFileSync('mcp/README.md', 'utf8');
  const rootReadme = readFileSync('README.md', 'utf8');

  // 1. 首选 npx 免克隆、免构建的主流使用方式
  assert.match(mcpReadme, /npx -y mingyu-mcp/);
  assert.match(rootReadme, /npx -y mingyu-mcp/);

  // 2. 源码开发章节应按顺序包含依赖安装与核心构建
  assert.match(mcpReadme, /pnpm install --frozen-lockfile/);
  assert.match(mcpReadme, /pnpm --filter mingyu-core build/);
  assert.match(mcpReadme, /pnpm mcp/);

  // 3. 不得出现容易误导的根项目 npm install 或 npm run mcp
  const rootNpmInstall = mcpReadme
    .split('\n')
    .filter((line) => /^\s*npm\s+install\s*$/.test(line.trim()));
  assert.equal(rootNpmInstall.length, 0, 'mcp/README.md 不应出现无参数的根项目 npm install 命令');
  assert.doesNotMatch(mcpReadme, /npm run mcp/);

  // 4. 客户端配置推荐 npx 零门槛方式，并支持 pnpm 源码方式
  assert.match(mcpReadme, /"args":\s*\["-y",\s*"mingyu-mcp"\]/);
  assert.match(mcpReadme, /"command":\s*"pnpm\.cmd"/);

  // 5. packages/mcp 独立发布包元数据应完备
  assert.ok(existsSync('packages/mcp/package.json'), 'packages/mcp/package.json 必须存在');
  const mcpPkg = JSON.parse(readFileSync('packages/mcp/package.json', 'utf8'));
  assert.equal(mcpPkg.name, 'mingyu-mcp');
  assert.equal(mcpPkg.bin['mingyu-mcp'], './dist/server.js');
  assert.ok(existsSync('packages/mcp/README.md'), 'packages/mcp/README.md 必须存在');
});
