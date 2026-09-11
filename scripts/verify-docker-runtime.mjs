import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entryPath = path.join(projectRoot, 'server-dist', 'docker-server.mjs');
const port = await getAvailablePort();
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [entryPath], {
  cwd: projectRoot,
  env: {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    AI_BUILTIN_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString('utf8');
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString('utf8');
});

try {
  await waitUntilReady(`${origin}/api/v1/health`, child);

  const missingAsset = await fetch(`${origin}/assets/definitely-missing.js`);
  assert.equal(missingAsset.status, 404);
  assert.match(missingAsset.headers.get('content-type') ?? '', /^text\/plain/);
  assert.equal(missingAsset.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await missingAsset.text(), /<!doctype html>/i);

  const spaRoute = await fetch(`${origin}/records`);
  assert.equal(spaRoute.status, 200);
  assert.match(spaRoute.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(spaRoute.headers.get('cache-control'), 'no-cache');

  const unsupportedMethod = await fetch(`${origin}/`, { method: 'POST' });
  assert.equal(unsupportedMethod.status, 405);
  assert.equal(unsupportedMethod.headers.get('allow'), 'GET,HEAD');

  const mcpGet = await fetch(`${origin}/mcp`);
  assert.equal(mcpGet.status, 200);
  const mcpJson = await mcpGet.json();
  assert.equal(mcpJson.status, 'ok');
  assert.equal(mcpJson.endpoint, '/mcp');

  const lifetimeInput = {
    birthDateTime: '1994-06-15T12:00:00',
    timeZoneId: 'Asia/Shanghai',
    timeStandard: 'civil',
    periodRange: { startDate: '2026-01-01', endDate: '2056-12-31' },
    question: '分析完整目标时段的事业变化。',
  };
  const lifetime = await postJson('/api/v1/divination/qimen/lifetime/prompt', lifetimeInput);
  assert.ok(lifetime.prompt.length > 100_000);
  assert.deepEqual(lifetime.result.input.periodRange, lifetimeInput.periodRange);
  assert.equal(lifetime.result.eventClusters.length, 161);
  assert.equal(
    lifetime.result.eventClusters.flatMap((item) => item.triggerDates ?? []).length,
    3806,
  );

  const yilin = await postJson('/api/v1/classics/yilin', {
    baseHexagram: '乾',
    targetHexagram: '需',
    source: 'both',
  });
  assert.equal(yilin.edition.parsedPairCount, 4096);
  assert.ok(yilin.sources.kanripo?.text);
  assert.ok(yilin.sources.wikisource?.text);

  const wuyun = await postJson('/api/v1/metaphysics/wuyun-liuqi/calculate', {
    year: 2026,
    yearGanZhi: '丙午',
    detailMode: 'full',
  });
  assert.equal(wuyun.input.yearGanZhi, '丙午');
  assert.equal(wuyun.annualMovement.name, '水运');
  assert.equal(wuyun.movementSteps.length, 5);
  assert.equal(wuyun.qiSteps.length, 6);
  assert.ok(wuyun.pathomechanism.classicalReference.condition);

  const xuankong = await postJson('/api/v1/metaphysics/xuankong/calculate', {
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

  const soundReference = await postJson('/api/v1/metaphysics/huangji-jingshi/references', {
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

  const animalPlantReference = await postJson('/api/v1/metaphysics/huangji-jingshi/references', {
    table: 'animal-plant',
    detailMode: 'full',
  });
  assert.equal(animalPlantReference.table, 'animal-plant');
  assert.equal(animalPlantReference.counts.length, 6);
  assert.equal(
    animalPlantReference.counts.find((item) => item.name === '动物之用数')?.value,
    17024,
  );

  const historicalReference = await postJson('/api/v1/metaphysics/huangji-jingshi/references', {
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
    const block = await postJson('/api/v1/metaphysics/huangji-jingshi/references', {
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

  console.log(
    'Docker 运行时静态资源、SPA 回退、请求方法、MCP 端点及易林、五运六气、替卦、皇极资料 API 检查通过。',
  );
} catch (error) {
  if (output.trim()) console.error(output.trim());
  throw error;
} finally {
  child.kill();
  await Promise.race([once(child, 'exit'), delay(3000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const selectedPort = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(selectedPort)));
    });
  });
}

async function waitUntilReady(url, serverProcess) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Docker 运行时提前退出，退出码 ${serverProcess.exitCode}。`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // 服务仍在启动。
    }
    await delay(100);
  }
  throw new Error('等待 Docker 运行时启动超时。');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(pathname, payload) {
  const response = await fetch(`${origin}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`${pathname} 未返回 JSON：${raw.slice(0, 500)}`);
  }
  assert.equal(response.status, 200, `${pathname} 返回异常：${JSON.stringify(body)}`);
  assert.equal(body.ok, true, `${pathname} 未返回 ok=true：${JSON.stringify(body)}`);
  assert.ok(body.data && typeof body.data === 'object', `${pathname} 缺少 data：${raw}`);
  return body.data;
}
