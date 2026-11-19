import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { generateApiDocsHtml, generateApiDocsMarkdown } from '../scripts/generate-api-docs';
import { buildSkillZipBuffer } from '../scripts/build-skill-package.mjs';
import { methodIds } from '../src/schema';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

test('API 文档生成器覆盖全部 40 种术数与核心端点', () => {
  const md = generateApiDocsMarkdown('https://mingyu.example');
  const html = generateApiDocsHtml();

  for (const endpoint of ['/api/methods', '/api/schema', '/api/prompts', '/api/calculate', '/api/prompt']) {
    assert.ok(md.includes(endpoint), `Markdown 缺少 ${endpoint}`);
    assert.ok(html.includes(endpoint), `HTML 缺少 ${endpoint}`);
  }
  for (const method of methodIds) {
    assert.ok(md.includes(`\`${method}\``), `Markdown 缺少术数 ${method}`);
    assert.ok(html.includes(`id="method-${method}"`), `HTML 缺少术数锚点 ${method}`);
  }
  assert.ok(html.includes('/api-docs.md'), 'HTML 应包含纯文本版链接');
});

test('本地 CLI 与 Skill 压缩包可独立运行并完成排盘与追问', () => {
  const zip = buildSkillZipBuffer(rootDir, { rebuildCli: true });
  assert.ok(zip.length > 1024 * 1024, 'Skill 压缩包应包含完整打包后的单文件 JS');
  assert.equal(zip.readUInt32LE(0), 0x04034b50, '应输出标准 ZIP 文件头');

  const mcpJsonPath = join(rootDir, 'skills', 'mingyu', '.mcp.json');
  assert.equal(existsSync(mcpJsonPath), true, 'Skill 目录应提供标准 .mcp.json');
  const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8')) as {
    mcpServers?: { mingyu?: { type?: string; url?: string } };
  };
  assert.equal(mcpConfig.mcpServers?.mingyu?.type, 'streamableHttp');
  assert.equal(mcpConfig.mcpServers?.mingyu?.url, 'https://aov.cc/mcp?mode=router');

  const zipBinaryText = zip.toString('latin1');
  for (const expectedEntry of [
    'mingyu/SKILL.md',
    'mingyu/.mcp.json',
    'mingyu/references/FAQ.md',
    'mingyu/references/time-calibration.md',
    'mingyu/references/scenario-natal.md',
    'mingyu/references/scenario-divination.md',
    'mingyu/references/scenario-naming.md',
    'mingyu/scripts/mingyu.mjs',
  ]) {
    assert.ok(zipBinaryText.includes(expectedEntry), `Skill 压缩包应包含 ${expectedEntry}`);
  }

  const cliEntry = join(rootDir, 'dist-cli', 'mingyu.mjs');
  assert.equal(existsSync(cliEntry), true);

  const scratch = mkdtempSync(join(tmpdir(), 'mingyu-cli-test-'));
  try {
    const standalone = join(scratch, 'mingyu.mjs');
    writeFileSync(standalone, readFileSync(cliEntry));

    const methodsOut = JSON.parse(execFileSync(process.execPath, [standalone, 'methods'], { cwd: scratch, encoding: 'utf8' }));
    assert.deepEqual(methodsOut.methods, methodIds);

    const calcPath = join(scratch, 'result.json');
    const calcOut = JSON.parse(
      execFileSync(
        process.execPath,
        [
          standalone,
          'calculate',
          'tarot',
          '--input',
          JSON.stringify({ question: '测试运势', tarot: { spread: 'single', manualCards: [{ id: 1, reversed: false }] } }),
          '--output',
          calcPath,
        ],
        { cwd: scratch, encoding: 'utf8' },
      ),
    );
    assert.equal(calcOut.method, 'tarot');
    assert.ok(calcOut.prompt?.text);

    const repromptOut = JSON.parse(
      execFileSync(
        process.execPath,
        [standalone, 'reprompt', '--result-file', calcPath, '--question', '接下来如何行动？'],
        { cwd: scratch, encoding: 'utf8' },
      ),
    );
    assert.ok(repromptOut.prompt?.text.includes('接下来如何行动？'));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
