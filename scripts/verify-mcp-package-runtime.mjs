import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mcpDirectory = path.join(projectRoot, 'packages', 'mcp');
const mcpEntry = path.join(mcpDirectory, 'dist', 'server.js');
const pnpmEntry = process.env.npm_execpath;

assert.ok(existsSync(mcpEntry), `未找到已构建的 MCP 入口：${mcpEntry}，请先完成 MCP 构建。`);

const packageManifest = JSON.parse(readFileSync(path.join(mcpDirectory, 'package.json'), 'utf8'));
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'mingyu-mcp-package-runtime-'));
const tarballPath = path.join(
  temporaryRoot,
  `${packageManifest.name}-${packageManifest.version}.tgz`,
);
const consumerDirectory = path.join(temporaryRoot, 'consumer');
let client;

try {
  mkdirSync(consumerDirectory, { recursive: true });
  runPnpm(['pack', '--out', tarballPath], mcpDirectory);
  writeFileSync(
    path.join(consumerDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: 'mingyu-mcp-package-consumer',
        private: true,
        type: 'module',
        dependencies: {
          [packageManifest.name]: `file:${tarballPath}`,
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  runPnpm(['install', '--prefer-offline', '--ignore-scripts'], consumerDirectory, {
    npm_config_auto_install_peers: 'false',
  });

  const installedEntry = path.join(
    consumerDirectory,
    'node_modules',
    packageManifest.name,
    'dist',
    'server.js',
  );
  assert.ok(existsSync(installedEntry), `隔离安装后未找到 MCP 入口：${installedEntry}`);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [installedEntry],
    cwd: consumerDirectory,
    stderr: 'pipe',
  });
  client = new Client({ name: 'mingyu-mcp-package-runtime-check', version: '1.0.0' });
  await client.connect(transport);

  const listed = await client.listTools();
  const toolNames = new Set(listed.tools.map((tool) => tool.name));
  for (const name of [
    'classics_yilin_query',
    'metaphysics_wuyun_liuqi',
    'metaphysics_xuankong',
    'huangji_reference_tables',
  ]) {
    assert.equal(toolNames.has(name), true, `MCP tools/list 缺少工具：${name}`);
  }

  const yilin = await callTool(client, 'classics_yilin_query', {
    baseHexagram: '乾',
    targetHexagram: '需',
    source: 'both',
  });
  assert.equal(yilin.edition.parsedPairCount, 4096);
  assert.ok(yilin.sources.kanripo?.text);
  assert.ok(yilin.sources.wikisource?.text);

  const wuyun = await callTool(client, 'metaphysics_wuyun_liuqi', {
    year: 2026,
    yearGanZhi: '丙午',
    detailMode: 'full',
  });
  assert.equal(wuyun.input.yearGanZhi, '丙午');
  assert.equal(wuyun.annualMovement.name, '水运');
  assert.equal(wuyun.movementSteps.length, 5);
  assert.equal(wuyun.qiSteps.length, 6);
  assert.ok(wuyun.pathomechanism.classicalReference.condition);

  const xuankong = await callTool(client, 'metaphysics_xuankong', {
    year: 2024,
    sitMountain: '子',
    facingMountain: '午',
    guaType: '替卦',
    detailMode: 'full',
  });
  assert.equal(xuankong.guaType, '替卦');
  assert.equal(xuankong.replacementApplied, true);
  assert.equal(xuankong.replacement.mountain.referenceMountain, '子');
  assert.equal(xuankong.replacement.facing.referenceMountain, '巽');

  const lifetimeInput = {
    birthDateTime: '1994-06-15T12:00:00',
    timeZoneId: 'Asia/Shanghai',
    timeStandard: 'civil',
    periodRange: { startDate: '2026-01-01', endDate: '2056-12-31' },
    question: '分析完整目标时段的事业变化。',
  };
  const lifetimeResponse = await client.callTool({
    name: 'qimen_lifetime_prompt',
    arguments: lifetimeInput,
  });
  assert.notEqual(lifetimeResponse.isError, true);
  const lifetime = lifetimeResponse.structuredContent;
  assert.ok(lifetime.prompt.length > 100_000);
  assert.deepEqual(lifetime.result.input.periodRange, lifetimeInput.periodRange);
  assert.equal(lifetime.result.eventClusters.length, 161);
  assert.equal(
    lifetime.result.eventClusters.flatMap((item) => item.triggerDates ?? []).length,
    3806,
  );

  const soundReference = await callTool(client, 'huangji_reference_tables', {
    table: 'sound-rhythm',
    detailMode: 'full',
  });
  assert.equal(soundReference.table, 'sound-rhythm');
  assert.equal(soundReference.bodyCounts.heavenlyUseSound, 112);
  assert.equal(soundReference.bodyCounts.earthlyUseTone, 152);
  assert.equal(soundReference.pairings.length, 4);
  assert.deepEqual(
    soundReference.diagramCounts.map((item) => [item.value, item.formula]),
    [
      [1064, '7×152'],
      [560, '5×112'],
    ],
  );
  assert.ok(soundReference.source.every((source) => source.url));

  const historicalReference = await callTool(client, 'huangji_reference_tables', {
    table: 'historical-era',
    shiIndex: 2190,
    detailMode: 'full',
  });
  assert.equal(historicalReference.table, 'historical-era');
  assert.equal(historicalReference.shiIndex, 2190);
  assert.equal(historicalReference.rows.length, 30);
  assert.equal(historicalReference.namedEntries[0].label, '商武丁');
  assert.ok(historicalReference.source.url);
  let historicalRowCount = 0;
  for (let shiIndex = 2149; shiIndex <= 2208; shiIndex += 1) {
    const block = await callTool(client, 'huangji_reference_tables', {
      table: 'historical-era',
      shiIndex,
      detailMode: 'full',
    });
    assert.equal(block.rows.length, 30);
    assert.ok(block.rows.every((row) => typeof row.sourceText === 'string'));
    historicalRowCount += block.rows.length;
  }
  assert.equal(historicalRowCount, 1800);
  assert.equal(historicalReference.rows[23].sourceText, '商武丁');

  console.log('MCP 发布包隔离安装后的 initialize、tools/list 与四类工具调用检查通过。');
} finally {
  try {
    if (client) await client.close();
  } finally {
    removeOwnedTemporaryDirectory(temporaryRoot);
  }
}

async function callTool(mcpClient, name, arguments_) {
  const response = await mcpClient.callTool({ name, arguments: arguments_ });
  assert.notEqual(response.isError, true, `${name} 调用失败：${JSON.stringify(response)}`);
  const structured = response.structuredContent;
  assert.ok(structured && typeof structured === 'object', `${name} 缺少结构化结果。`);
  const result = structured.result;
  assert.ok(result && typeof result === 'object', `${name} 缺少 result。`);
  return result;
}

function runPnpm(args, cwd, extraEnv = {}) {
  const command = pnpmEntry ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const commandArgs = pnpmEntry ? [pnpmEntry, ...args] : args;
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} 执行失败。\n${output}`);
  }
}

function removeOwnedTemporaryDirectory(directory) {
  const ownedRoot = path.resolve(directory);
  const systemTemporaryRoot = path.resolve(tmpdir());
  if (ownedRoot.startsWith(`${systemTemporaryRoot}${path.sep}`) && existsSync(ownedRoot)) {
    rmSync(ownedRoot, { recursive: true, force: true });
  }
}
