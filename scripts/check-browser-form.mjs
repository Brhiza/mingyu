import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

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
const dir = await mkdtemp(join(tmpdir(), 'mingyu-browser-'));
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
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const calls = new Map();
  const runtimeErrors = [];

  await new Promise((resolve) => setTimeout(resolve, 50));
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      calls.set(n, { resolve, reject });
      socket.send(JSON.stringify({ id: n, method, params }));
    });

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(
        msg.params?.exceptionDetails?.exception?.description ??
          msg.params?.exceptionDetails?.text ??
          'Unknown exception',
      );
    }
    if (msg.id && calls.has(msg.id)) {
      const call = calls.get(msg.id);
      calls.delete(msg.id);
      msg.error ? call.reject(Error(msg.error.message)) : call.resolve(msg.result);
    }
  };

  await send('Runtime.enable');

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw Error(`${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    }
    return r.result.value;
  };

  const waitFor = async (expression, message, attempts = 120) => {
    for (let i = 0; i < attempts; i++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(message);
  };

  const clickByText = (selector, text) =>
    evaluate(`(() => {
      const list = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const el = list.find((node) => node.textContent?.trim().includes(${JSON.stringify(text)}));
      if (!el) return false;
      el.click();
      return true;
    })()`);

  // 1. 验证 React 根挂载、PWA/图标 Meta 与无遗留测试外壳
  await waitFor(
    "Boolean(document.querySelector('#v2-workspace-root .workspace-shell'))",
    'React 主工作台未挂载',
  );
  const headCheck = await evaluate(`({
    hasLegacyHarness: Boolean(document.querySelector('#legacy-test-harness')),
    hasManifest: Boolean(document.querySelector('link[rel="manifest"]')),
    hasFavicon: Boolean(document.querySelector('link[rel="icon"]')),
  })`);
  assert.equal(headCheck.hasLegacyHarness, false, '生产页面不应再挂载 #legacy-test-harness');
  assert.equal(headCheck.hasManifest, true, '缺少 manifest 声明');
  assert.equal(headCheck.hasFavicon, true, '缺少站点图标声明');

  // 2. 使用指南弹窗验证
  assert.equal(await clickByText('.workspace-topbar-action-btn', '使用指南'), true);
  await waitFor("Boolean(document.querySelector('#tutorial-modal-title'))", '使用指南弹窗未打开');
  assert.equal(await clickByText('[role="dialog"] button', '我知道了'), true);

  // 3. 个人命盘全流程（八字 -> 八宅二十四山 -> 流年年份切换 -> 导出长图）
  assert.equal(await clickByText('.workspace-topbar-tab', '命盘排盘'), true);
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '开始排盘'))",
    '命盘输入表单未渲染',
  );
  assert.equal(await clickByText('button', '开始排盘'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden]) .board-view svg, .workspace-result-page-shell:not([hidden]) .board-view > *'))",
    '八字结果盘面未渲染',
  );

  // 切换八宅并测试二十四山坐山选择
  assert.equal(await clickByText('.workspace-result-navigation button', '八宅'), true);
  await waitFor("Boolean(document.querySelector('select[aria-label=\"选择宅屋坐山\"]'))", '八宅坐山选择器未出现');
  await evaluate(`(() => {
    const sel = document.querySelector('select[aria-label="选择宅屋坐山"]');
    sel.value = '卯';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(
    "(document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').includes('卯')",
    '切换八宅坐山后未重算卯山盘面',
  );

  // 切回八字并切换流年年份
  assert.equal(await clickByText('.workspace-result-navigation button', '八字'), true);
  await waitFor("Boolean(document.querySelector('select[aria-label=\"选择推运年份\"]'))", '流年年份选择器未出现');
  await evaluate(`(() => {
    const sel = document.querySelector('select[aria-label="选择推运年份"]');
    sel.value = '2028';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(
    "(document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').includes('2028')",
    '切换流年年份后未更新 2028 岁运',
  );

  // 验证长图导出按钮可正常触发 Canvas 导出
  await evaluate(`(() => {
    window.__shareClicked = false;
    HTMLAnchorElement.prototype.click = function () {
      if (String(this.download || '').endsWith('.png')) window.__shareClicked = true;
    };
  })()`);
  assert.equal(await clickByText('.workspace-result-share-btn', '导出长图'), true);
  await waitFor('window.__shareClicked === true', '长图导出未触发 PNG 下载');

  // 3b. 双人合盘：合盘场景切换与分析侧重点联动验证
  assert.equal(await clickByText('.workspace-topbar-tab', '命盘排盘'), true);
  assert.equal(await clickByText('.ws-page-tabs button', '双人合盘'), true);
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === '事业合伙'))",
    '双人合盘场景选择器未渲染',
  );
  assert.equal(await clickByText('button', '事业合伙'), true);
  assert.equal(await clickByText('button', '开始合盘'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').includes('【合伙任务】'))",
    '双人合盘事业合伙场景未注入【合伙任务】',
  );

  // 4. 出生范围扫描（直达 /chart/range 并验证 Web Worker 异步扫描）
  await send('Page.navigate', { url: new URL('/chart/range', pageUrl).toString() });
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('开始逐秒范围扫描')))",
    '出生范围扫描表单未就绪',
  );
  assert.equal(await clickByText('button', '开始逐秒范围扫描'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').length > 40)",
    '出生范围扫描结果未打开',
    240,
  );

  // 5. 统一首页输入框 + 展开「更多工具」进入工具箱：干支天文历（含 5 项天文时间尺度）与周易经文
  assert.equal(await clickByText('.workspace-topbar-tab', '首页'), true);
  await waitFor(
    "Boolean(document.querySelector('textarea[aria-label=\"输入想问的事\"]'))",
    '统一首页居中提问输入框未渲染',
  );
  assert.equal(await clickByText('button', '更多工具'), true);
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('择吉万年历')))",
    '点击更多工具后快捷卡片未展开',
  );
  assert.equal(await clickByText('button', '择吉万年历'), true);
  await waitFor("Boolean(document.querySelector('[aria-label=\"实用工具模块\"]'))", '工具页主切换栏未出现');
  assert.equal(await clickByText('[aria-label="实用工具模块"] button', '干支天文历'), true);
  await waitFor("Boolean(document.querySelector('.workspace-calendar-page .almanac-astro-panel'))", '干支天文历页面未加载');
  assert.equal(await clickByText('.workspace-calendar-page .almanac-astro-panel button', '天文时间尺度'), true);
  await waitFor(
    "(document.querySelector('.workspace-calendar-page .almanac-astro-panel')?.textContent ?? '').includes('JD_TT')",
    '天文时间尺度计算结果未展示',
  );

  assert.equal(await clickByText('[aria-label="实用工具模块"] button', '汉字经籍'), true);
  await waitFor("Boolean(document.querySelector('[aria-label=\"汉字经籍子模块\"]'))", '汉字经籍子模块未加载');
  assert.equal(await clickByText('[aria-label="汉字经籍子模块"] button', '周易经文'), true);
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('查询《周易》原文')))",
    '周易经文检索界面未就绪',
  );
  assert.equal(await clickByText('button', '查询《周易》原文'), true);
  await waitFor(
    "(document.body.innerText ?? '').includes('大哉乾元')",
    '周易经文检索结果未显示《彖传》经文',
  );

  if (process.env.MINGYU_BROWSER_SCREENSHOT) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(process.env.MINGYU_BROWSER_SCREENSHOT, Buffer.from(shot.data, 'base64'));
  }

  assert.deepEqual(runtimeErrors, [], `页面运行产生未捕获异常：${runtimeErrors.join('; ')}`);
  console.log('真实 React 工作台端到端浏览器检查通过。');
} finally {
  try {
    socket?.close();
  } catch {}
  chrome.kill('SIGKILL');
  await rm(dir, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
}
