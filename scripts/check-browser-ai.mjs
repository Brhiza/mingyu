import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const candidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

let executable;
for (const path of candidates) {
  try {
    await access(path);
    executable = path;
    break;
  } catch {}
}
if (!executable) {
  throw new Error('未找到 Chrome 或 Chromium；请通过 CHROME_PATH 指定。');
}

const pageUrl = process.env.MINGYU_BROWSER_TEST_URL ?? 'http://127.0.0.1:18788/';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const withoutSentTime = (content) =>
  content.replace(/\n\n【本次发送时间（UTC）】\n\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, '');

const calls = [];
const listCalls = [];
let simplePreflights = 0;

const provider = createServer(async (request, response) => {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-headers', 'authorization, content-type');
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');

  if (request.method === 'OPTIONS') {
    if (request.url?.startsWith('/simple/')) {
      simplePreflights++;
      response.writeHead(403).end();
      return;
    }
    response.writeHead(204).end();
    return;
  }

  if (request.method === 'GET' && request.url?.endsWith('/models')) {
    listCalls.push(request.url);
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
    return;
  }

  if (request.method !== 'POST' || !request.url?.endsWith('/chat/completions')) {
    response.writeHead(404).end();
    return;
  }

  let body = '';
  for await (const chunk of request) body += chunk;
  const parsed = JSON.parse(body);
  calls.push({ url: request.url, auth: request.headers.authorization, body: parsed });

  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
  });
  const user = withoutSentTime(String(parsed.messages?.at(-1)?.content ?? ''));
  const event = (content, finish) =>
    `data: ${JSON.stringify({
      choices: [{ delta: content ? { content } : {}, ...(finish ? { finish_reason: finish } : {}) }],
    })}\n\n`;

  if (user === '停止测试') {
    response.write(event('已收到部分'));
    return;
  }

  const text = user === '追问测试' ? '追问回复完成' : '首次回复完成';
  response.write(event(text.slice(0, 2)));
  setTimeout(() => {
    if (!response.destroyed) {
      response.end(event(text.slice(2), 'stop') + 'data: [DONE]\n\n');
    }
  }, 20);
});

await new Promise((resolve, reject) => {
  provider.once('error', reject);
  provider.listen(0, '127.0.0.1', resolve);
});

const base = `http://127.0.0.1:${provider.address().port}`;
const dir = await mkdtemp(join(tmpdir(), 'mingyu-browser-ai-'));
const chrome = spawn(
  executable,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${dir}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = Number((await readFile(join(dir, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      if (port) break;
    } catch {}
    await pause(100);
  }
  assert.ok(port, 'Chrome 未启动');

  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(pageUrl)}`, {
      method: 'PUT',
    })
  ).json();

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const call = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? call.reject(Error(msg.error.message)) : call.resolve(msg.result);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      socket.send(JSON.stringify({ id: n, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw Error(
        `${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ''}`,
      );
    }
    return result.result.value;
  };

  const waitFor = async (expression, message) => {
    for (let i = 0; i < 120; i++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(message);
  };

  const clickByText = (selector, text) =>
    evaluate(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((node) => node.textContent?.trim().includes(${JSON.stringify(text)}));
      if (!el) return false;
      el.click();
      return true;
    })()`);

  await waitFor(
    "Boolean(document.querySelector('#v2-workspace-root .workspace-shell'))",
    'React 工作台未挂载',
  );

  // 1. 打开「接入 AI」页验证配置界面并开启站内 AI
  assert.equal(await clickByText('.workspace-topbar-tab', '接入 AI'), true);
  await waitFor("Boolean(document.querySelector('[role=\"switch\"]'))", '接入 AI 页面未打开');
  await evaluate("document.querySelector('[role=\"switch\"]')?.click()");
  await waitFor("Boolean(document.querySelector('input[type=\"url\"]'))", '站内 AI 接口配置表单未展开');

  // 进入命盘排盘结果页（sharedAiPane 会自动挂载至结果页右侧）
  assert.equal(await clickByText('.workspace-topbar-tab', '命盘排盘'), true);
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '开始排盘'))",
    '命盘输入表单未就绪',
  );
  assert.equal(await clickByText('button', '开始排盘'), true);
  await waitFor("Boolean(document.querySelector('#ai-list'))", '结果页共享 AI 面板未挂载');

  // 先测试无密钥简单跨域模型拉取不触发预检
  await evaluate(`(() => {
    localStorage.setItem('mingyu.v2.ai.webEnabled', 'true');
    localStorage.setItem('mingyu.v2.ai.baseUrl', ${JSON.stringify(`${base}/simple`)});
    localStorage.setItem('mingyu.v2.ai.apiKey', '');
    localStorage.setItem('mingyu.v2.ai.model', 'mock-model');
    window.dispatchEvent(new CustomEvent('mingyu:web-ai-changed'));
    const baseInput = document.querySelector('#ai-base');
    const keyInput = document.querySelector('#ai-key');
    baseInput.value = ${JSON.stringify(`${base}/simple`)};
    keyInput.value = '';
    baseInput.dispatchEvent(new Event('input', { bubbles: true }));
    keyInput.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#ai-list').click();
  })()`);
  await waitFor(
    "document.querySelector('#ai-status')?.textContent?.includes('已获取')",
    '无密钥模型列表拉取未成功',
  );
  assert.ok(listCalls.includes('/simple/models'));
  assert.equal(simplePreflights, 0, '无密钥模型列表不应触发跨域预检');

  // 切换到带密钥配置并等待 #ai-start 就绪
  await evaluate(`(() => {
    localStorage.setItem('mingyu.v2.ai.webEnabled', 'true');
    localStorage.setItem('mingyu.v2.ai.baseUrl', ${JSON.stringify(`${base}/v1`)});
    localStorage.setItem('mingyu.v2.ai.apiKey', 'test-key');
    localStorage.setItem('mingyu.v2.ai.model', 'mock-model');
    window.dispatchEvent(new CustomEvent('mingyu:web-ai-changed'));
    const syncField = (selector, val) => {
      const el = document.querySelector(selector);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    syncField('#ai-base', ${JSON.stringify(`${base}/v1`)});
    syncField('#ai-key', 'test-key');
    syncField('#ai-model', 'mock-model');
  })()`);
  await waitFor("Boolean(document.querySelector('#ai-start') && !document.querySelector('#ai-start').disabled)", '结果页 AI 面板未就绪');

  await evaluate("document.querySelector('#ai-start').click()");
  await waitFor(
    "(document.querySelector('#ai-output')?.textContent ?? '').includes('首次回复完成')",
    '首次 AI 解读未流式完成',
  );

  // 测试继续追问
  await evaluate(`(() => {
    const q = document.querySelector('#ai-question');
    q.value = '追问测试';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#ai-ask').click();
  })()`);
  await waitFor(
    "(document.querySelector('#ai-output')?.textContent ?? '').includes('追问回复完成')",
    'AI 追问流式回复未完成',
  );

  // 测试流式中止
  await evaluate(`(() => {
    const q = document.querySelector('#ai-question');
    q.value = '停止测试';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#ai-ask').click();
  })()`);
  await waitFor(
    "(document.querySelector('#ai-output')?.textContent ?? '').includes('已收到部分') && !document.querySelector('#ai-stop').disabled",
    '中止测试未收到流式片段',
  );
  await evaluate("document.querySelector('#ai-stop').click()");
  await waitFor(
    "(document.querySelector('#ai-status')?.textContent ?? '').includes('已停止')",
    '中止后状态未更新为已停止',
  );

  assert.equal(calls.length, 3);
  assert.equal(calls[0].auth, 'Bearer test-key');
  console.log('真实 React 工作台 AI 接入与流式解读检查通过。');
} finally {
  try {
    socket?.close();
  } catch {}
  chrome.kill('SIGKILL');
  provider.closeAllConnections?.();
  provider.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
