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
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      runtimeErrors.push(
        msg.params.args?.map((a) => a.value ?? a.description).join(' ') || 'console.error',
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

  // 2. 个人命盘全流程（八字 -> 流年年份切换；确认八宅已移出个人命盘标签栏）
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

  const hasBazhaiInPersonalNav = await evaluate(`(() => {
    return [...document.querySelectorAll('.workspace-result-navigation button')].some((b) =>
      b.textContent?.trim().includes('八宅'),
    );
  })()`);
  assert.equal(hasBazhaiInPersonalNav, false, '八宅不应再出现在个人命盘结果导航栏中');

  // 切换流年年份
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
    "Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('开始扫描')))",
    '出生范围扫描表单未就绪',
  );
  assert.equal(await clickByText('button', '开始扫描'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').length > 40)",
    '出生范围扫描结果未打开',
    240,
  );

  // 5. 统一首页输入框 + 桌面直接展开的独立工具页面：万年历（含天文历法 5 项时间尺度）与周易经文
  const openStandaloneUtility = async (cardLabel) => {
    await pause(120);
    assert.equal(await clickByText('.workspace-topbar-tab', '首页'), true);
    await waitFor("location.pathname === '/'", '切换回首页超时');
    await waitFor(
      `Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('${cardLabel}')))`,
      `首页入口「${cardLabel}」未渲染`,
    );
    assert.equal(await clickByText('button', cardLabel), true);
  };

  await openStandaloneUtility('万年历');
  await waitFor("Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('天文历法')))", '天文历法入口按钮未加载');
  assert.equal(await clickByText('button', '天文历法'), true);
  await waitFor("Boolean(document.querySelector('[role=\"dialog\"] .workspace-calendar-page .almanac-astro-panel'))", '天文历法弹窗未加载');
  assert.equal(await clickByText('[role="dialog"] .workspace-calendar-page .almanac-astro-panel button', '天文时间尺度'), true);
  await waitFor(
    "(() => { const t = document.querySelector('[role=\"dialog\"] .workspace-calendar-page .almanac-astro-panel')?.textContent ?? ''; return t.includes('JD_TT') || t.includes('近似地球力学时'); })()",
    '天文时间尺度计算结果未展示',
  );
  assert.equal(
    await evaluate(`(() => { const btn = document.querySelector('[role="dialog"] [aria-label="关闭窗口"]'); if (!btn) return false; btn.click(); return true; })()`),
    true,
    '未能关闭天文历法弹窗',
  );
  await waitFor(
    "location.pathname === '/utilities/almanac' && Boolean(document.querySelector('.almanac-topic-grid'))",
    '关闭天文历法弹窗后未回到万年历页面',
  );

  await openStandaloneUtility('汉字经籍');
  await waitFor("Boolean(document.querySelector('[aria-label=\"汉字经籍子模块\"]'))", '汉字经籍子模块未加载');
  assert.equal(await clickByText('[aria-label="汉字经籍子模块"] button', '周易经文'), true);
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('查询经文')))",
    '周易经文检索界面未就绪',
  );
  assert.equal(await clickByText('button', '查询经文'), true);
  await waitFor(
    "(document.body.innerText ?? '').includes('大哉乾元')",
    '周易经文检索结果未显示《彖传》经文',
  );

  // 6. 已纯 React 化的关键交互模块端到端回归：新建档案、六爻、塔罗、择吉万年历、阳宅风水、汉字字典
  const openUtilitiesTab = openStandaloneUtility;

  // 6a. CaseEditorModal 新建与保存个人档案
  assert.equal(await clickByText('.workspace-topbar-tab', '命盘排盘'), true);
  await waitFor("Boolean(document.querySelector('.person-form-workspace'))", '命盘工作区未加载');
  await evaluate("window.dispatchEvent(new CustomEvent('mingyu:open-case-picker'))");
  await waitFor(
    "Boolean([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('新建档案')))",
    '个人档案抽屉未打开',
  );
  assert.equal(await clickByText('button', '新建档案'), true);
  await waitFor(
    "Boolean([...document.querySelectorAll('[role=\"dialog\"] button')].some((b) => b.textContent?.includes('保存档案')))",
    '新建档案弹窗未打开',
  );
  await evaluate(`(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find((node) =>
      node.textContent?.includes('保存档案'),
    );
    const nameInput = dlg?.querySelector('input[placeholder*="姓名"], input[type="text"]');
    if (!nameInput) throw new Error('未找到档案姓名输入框');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(nameInput, '自动化测试命例');
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(await clickByText('[role="dialog"] button', '保存档案'), true);
  await waitFor(
    "!([...document.querySelectorAll('[role=\"dialog\"] button')].some((b) => b.textContent?.includes('保存档案')))",
    '新建档案弹窗未关闭',
  );
  await waitFor(
    "(document.body.textContent ?? '').includes('自动化测试命例')",
    '新建的个人档案未出现在列表中',
  );
  await evaluate(`(() => {
    const closeBtn = document.querySelector('[aria-label="关闭"], [aria-label="关闭面板"]');
    if (closeBtn) closeBtn.click();
  })()`);

  // 6b. 六爻连摇六次并起卦
  assert.equal(await clickByText('.workspace-topbar-tab', '占卜起卦'), true);
  await waitFor("Boolean(document.querySelector('.divination-card-selector-grid'))", '占卜输入页未加载');
  assert.equal(await clickByText('button', '一键连摇六爻'), true);
  await waitFor("(document.body.textContent ?? '').includes('6 / 6')", '六爻未完成 6 爻连摇');
  assert.equal(await clickByText('button', '开始占卜'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').length > 40)",
    '六爻占卜结果未生成',
  );

  // 6c. 塔罗牌阵抽牌与起卦
  assert.equal(await clickByText('.workspace-topbar-tab', '占卜起卦'), true);
  await waitFor("Boolean(document.querySelector('.divination-card-selector-grid'))", '返回占卜页面失败');
  assert.equal(await clickByText('button', '塔罗占卜'), true);
  await waitFor(
    "Boolean(document.querySelector('.tarot-spread-preview-table, .interactive-draw-session'))",
    '塔罗工作台未渲染',
  );
  assert.equal(await clickByText('button', '开始占卜'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').length > 40)",
    '塔罗占卜结果未生成',
  );

  // 6d. 万年历择日提交
  await openUtilitiesTab('万年历');
  await waitFor("Boolean(document.querySelector('.almanac-topic-grid'))", '择吉事项选择器未加载');
  assert.equal(await clickByText('button', '开始择日'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').length > 40)",
    '择吉日历结果未生成',
  );

  // 6e. 阳宅风水引导式体检：第1步朝向示意图与指南针角度 -> 第2步年份居住人 -> 第3步房间点选 -> 体检报告与户型图弹窗 -> AI 深度解读
  await openUtilitiesTab('阳宅风水');
  await waitFor(
    "Boolean(document.querySelector('[data-testid=\"fengshui-workbench\"] .fs-orientation-diagram'))",
    '阳宅风水引导第1步朝向示意图未渲染',
  );
  await evaluate(`(() => {
    const inp = document.querySelector('[data-testid="fengshui-workbench"] input[aria-label="指南针角度"]');
    if (!inp) throw new Error('指南针角度输入框缺失');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '270');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(
    "(document.querySelector('.fs-orientation-diagram')?.textContent ?? '').includes('坐东朝西')",
    '输入 270° 后示意图未联动为坐东朝西',
  );
  assert.equal(await clickByText('button', '下一步'), true);
  await waitFor("Boolean(document.body.textContent?.includes('谁来住这套房'))", '第2步未渲染');
  assert.equal(await clickByText('button', '下一步'), true);
  await waitFor("Boolean(document.querySelector('.fs-room-grid'))", '第3步房间网格未渲染');
  assert.equal(await clickByText('.fs-room-grid button', '正南'), true);
  assert.equal(await clickByText('button', '生成报告'), true);
  await waitFor(
    "Boolean(document.body.textContent?.includes('你家房间位置诊断') && document.querySelector('.fs-plain-cards-grid'))",
    '住宅体检报告未渲染',
  );
  assert.equal(await clickByText('button', '户型图叠罗盘'), true);
  await waitFor("Boolean(document.querySelector('[role=\"dialog\"][aria-label=\"户型图叠罗盘\"]'))", '户型图弹窗未打开');
  await evaluate(`(() => {
    const btn = document.querySelector('[role="dialog"] [aria-label="关闭窗口"]');
    if (btn) btn.click();
  })()`);
  assert.equal(await clickByText('button', 'AI 解读'), true);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').length > 40)",
    '阳宅风水结果未生成',
  );

  // 6f. 汉字字典查询
  await openUtilitiesTab('汉字经籍');
  await waitFor("Boolean(document.querySelector('[aria-label=\"汉字经籍子模块\"]'))", '汉字经籍子模块未加载');
  assert.equal(await clickByText('[aria-label="汉字经籍子模块"] button', '汉字字典'), true);
  await waitFor("Boolean(document.querySelector('.workspace-culture-page input'))", '汉字字典输入框未就绪');
  await evaluate(`(() => {
    const inp = document.querySelector('.workspace-culture-page input[type="text"], .workspace-culture-page input:not([type])');
    if (!inp) throw new Error('汉字字典输入框缺失');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '易');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await evaluate(`(() => {
    const btn = document.querySelector('.workspace-culture-page button[type="submit"], .workspace-culture-page .workspace-ui-button.is-primary');
    if (!btn) throw new Error('汉字字典提交按钮缺失');
    btn.click();
  })()`);
  await waitFor(
    "Boolean(document.querySelector('.workspace-result-page-shell:not([hidden])') && (document.querySelector('.workspace-prompt-preview-body pre')?.textContent ?? '').includes('易'))",
    '汉字字典查询结果未显示「易」字内容',
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
