import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import worker from '../src/worker';

function runArgs(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/qizheng-range.ts', ...args], { env: { ...process.env, MINGYU_ACCESS_TOKEN: 'range-test-token' } });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}
const run = (file: string, endpoint?: string) => runArgs([file, ...(endpoint ? [endpoint] : [])]);
test('命令行可本地或通过受保护 HTTP 续取并输出完整结果', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mingyu-range-test-'));
  const file = join(directory, 'input.json');
  await writeFile(file, JSON.stringify({ question: '候选盘？', birth: { year: 2024, month: 2, day: 19, hour: 11, minute: 24, second: 48, latitude: 39.9, longitude: 116.4, timezone: 8 }, range: { start: '2024-02-19T11:24:48+08:00', end: '2024-02-19T11:24:54+08:00', pageSize: 2 }, prompt: { topicId: 'career' } }));
  let calls = 0;
  const server = createServer(async (request, response) => {
    try {
      calls++;
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const result = await worker.fetch(new Request('http://local/api/calculate', { method: 'POST', headers: { 'content-type': 'application/json', authorization: request.headers.authorization ?? '' }, body: Buffer.concat(chunks) }), { ASSETS: { fetch: async () => new Response('') }, ENABLED_METHODS: 'qizheng-range', ACCESS_TOKEN: 'range-test-token' });
      response.writeHead(result.status, { 'content-type': 'application/json' }); response.end(await result.text());
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const local = await run(file), remote = await run(file, `http://127.0.0.1:${port}/api/calculate`);
    assert.equal(local.code, 0, local.stderr); assert.equal(remote.code, 0, remote.stderr); assert.equal(calls, 3);
    const a = JSON.parse(local.stdout), b = JSON.parse(remote.stdout);
    assert.equal(a.kind, 'qizheng-range-collection'); assert.equal(a.data.range.complete, true);
    assert.equal(a.method, 'qizheng-range'); assert.ok(Number.isFinite(Date.parse(a.currentTime)));
    assert.deepEqual(a.promptOptions, { topicId: 'career' });
    assert.deepEqual(a.data, b.data); assert.match(remote.stderr, /6\/6 秒/);
    const saved = join(directory, 'saved.json'); await writeFile(saved, local.stdout);
    const continued = await runArgs(['--reprompt', saved, '后续问题', `http://127.0.0.1:${port}/api/calculate`]);
    assert.equal(continued.code, 0, continued.stderr); assert.equal(calls, 6);
    const next = JSON.parse(continued.stdout); assert.deepEqual(next.data, a.data); assert.equal(next.currentTime, a.currentTime); assert.match(next.prompt.text, /后续问题/); assert.deepEqual(next.promptOptions, a.promptOptions);
    await writeFile(saved, continued.stdout);
    const again = await runArgs(['--reprompt', saved, '再次追问']); assert.equal(again.code, 0, again.stderr); assert.match(JSON.parse(again.stdout).prompt.text, /再次追问/);
    a.data.branches[0].first.mingGong = -1; await writeFile(saved, JSON.stringify(a));
    const altered = await runArgs(['--reprompt', saved, '后续问题']); assert.notEqual(altered.code, 0); assert.match(altered.stderr, /不一致/); assert.equal(altered.stdout, '');
    b.method = 'astrolabe-range'; await writeFile(saved, JSON.stringify(b));
    const wrong = await runArgs(['--reprompt', saved, '后续问题']); assert.notEqual(wrong.code, 0); assert.match(wrong.stderr, /类型或起始资料/);
    b.method = 'qizheng-range'; b.currentTime = 'next monday'; await writeFile(saved, JSON.stringify(b));
    const invalidTime = await runArgs(['--reprompt', saved, '后续问题']); assert.notEqual(invalidTime.code, 0); assert.match(invalidTime.stderr, /类型或起始资料/);
    const invalid = await run(file, 'file:///tmp/invalid'); assert.notEqual(invalid.code, 0); assert.match(invalid.stderr, /http 或 https/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
