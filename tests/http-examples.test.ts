import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';
import worker from '../src/worker';

const hasPython = spawnSync('python3', ['-c', 'import sys; sys.exit(sys.version_info < (3, 9))']).status === 0;
const nodeSource = `
import { calculate, reprompt } from './examples/http-client.mjs';
const result = await calculate('liuyao', { question: '原问题', currentTime: '2025-01-01T00:00:00Z', liuyao: { method: 'manual', yaos: [6,7,8,9,7,8] } });
const followup = await reprompt('liuyao', result, '继续追问', { currentTime: '2030-01-01T00:00:00Z', prompt: { liuyaoTemplate: 'shiye' } });
console.log(JSON.stringify({ result, followup }));`;
const pythonSource = `
import sys, json
sys.path.insert(0, 'examples')
from http_client import calculate, reprompt
result = calculate('liuyao', {'question': '原问题', 'currentTime': '2025-01-01T00:00:00Z', 'liuyao': {'method': 'manual', 'yaos': [6,7,8,9,7,8]}})
followup = reprompt('liuyao', result, '继续追问', current_time='2030-01-01T00:00:00Z', prompt={'liuyaoTemplate': 'shiye'})
print(json.dumps({'result': result, 'followup': followup}))`;

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env, PYTHONDONTWRITEBYTECODE: '1', NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' } });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code}: ${stderr}`)));
  });
}

async function exercise(language: 'node' | 'python') {
  const requests: { url: string; authorization?: string; body: any }[] = [];
  const server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      requests.push({ url: request.url!, authorization: request.headers.authorization, body: JSON.parse(body) });
      const result = await worker.fetch(new Request(`http://localhost${request.url!.replace(/^\/prefix/, '')}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: request.headers.authorization ?? '' }, body,
      }), { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'tarot,liuyao', ACCESS_TOKEN: 'test-token' });
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const env = { MINGYU_BASE_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}/prefix/`, MINGYU_ACCESS_TOKEN: 'test-token' };
  try {
    const command = language === 'node' ? process.execPath : 'python3';
    const importArgs = language === 'node'
      ? ['--input-type=module', '-e', "import { calculate, reprompt } from './examples/http-client.mjs'; if (!calculate || !reprompt) throw Error('missing exports');"]
      : ['-c', "import sys; sys.path.insert(0, 'examples'); from http_client import calculate, reprompt"];
    await run(command, importArgs, env);
    assert.equal(requests.length, 0, '导入模块不应发起请求');
    const args = language === 'node' ? ['--input-type=module', '-e', nodeSource] : ['-c', pythonSource];
    const { result, followup } = JSON.parse(await run(command, args, env));
    assert.deepEqual(result.data.yaoArray, [6, 7, 8, 9, 7, 8]);
    assert.match(followup.prompt.text, /继续追问/);
    assert.ok(followup.prompt.text.includes(result.data.originalName));
    assert.deepEqual(requests.map((item) => item.url), ['/prefix/api/calculate', '/prefix/api/prompt']);
    assert.ok(requests.every((item) => item.authorization === 'Bearer test-token'));
    assert.deepEqual(requests[1].body.result, result);
    assert.deepEqual(requests[1].body.prompt, { liuyaoTemplate: 'shiye' });
    assert.equal(requests[1].body.currentTime, '2030-01-01T00:00:00Z');
    const script = language === 'node' ? 'examples/http-client.mjs' : 'examples/http_client.py';
    const cli = JSON.parse(await run(command, [script, '初次问题', '后续问题'], env));
    assert.equal(cli.result.data.cards.length, 3);
    assert.match(cli.followup.prompt.text, /后续问题/);
    for (const card of cli.result.data.cards) assert.ok(cli.followup.prompt.text.includes(card.name));
    assert.deepEqual(requests.slice(2).map((item) => item.url), ['/prefix/api/calculate', '/prefix/api/prompt']);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('JavaScript 示例可导入、调用和追问', async () => exercise('node'));
test('Python 示例可导入、调用和追问', { skip: hasPython ? false : '需要 Python 3.9+' }, async () => exercise('python'));
