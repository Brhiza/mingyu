import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/pages/ResultPage.tsx', import.meta.url), 'utf8');

test('结果页不应渲染开发参考说明文案', () => {
  assert.doesNotMatch(source, /参考 `bz` 项目的专业盘表结构，按年、月、日、时展开。/);
  assert.doesNotMatch(source, /参考 `zw` 项目的传统盘布局，按 4x4 盘面集中展示十二宫。/);
  assert.doesNotMatch(source, /参考 `zw` 项目的结果页，先看时限与四化，再看宫位。/);
});

test('AI 页预览使用延迟值，复制和分享始终使用最新提示词', () => {
  assert.match(source, /const deferredBaziQuickQuestion = useDeferredValue\(effectiveBaziQuickQuestion\);/);
  assert.match(source, /const deferredZiweiQuickQuestion = useDeferredValue\(effectiveZiweiQuickQuestion\);/);
  assert.match(source, /const latestActivePromptText =/);
  assert.match(source, /const previewActivePromptText =/);
  assert.match(source, /await navigator\.clipboard\.writeText\(latestActivePromptText\);/);
  assert.match(source, /const ok = await shareText\(latestActivePromptText\);/);
  assert.match(source, /<div className="prompt-send-tip">\s*点击复制后，发送到你常用的在线 AI 软件继续提问。\s*<\/div>/);
  assert.match(source, /<pre className="result-pre">\{previewActivePromptText\}<\/pre>/);
});

test('AI 场景下紫微提示词数据走 Worker，进入紫微页后才补主线程运行时', () => {
  assert.match(source, /const shouldLoadZiweiPromptPayload =/);
  assert.match(source, /new Worker\(new URL\('\.\.\/workers\/ziwei-payload\.worker\.ts', import\.meta\.url\), \{/);
  assert.match(source, /if \(!mountedTabs\.ziwei \|\| !primaryZiweiInput\) \{/);
  assert.match(source, /const activeZiweiPayloadByScope = ziweiRuntime\?\.payloadByScope \?\? ziweiPayloadByScope;/);
});

test('紫微页切换时限时会用 Worker 重算展示盘面，并显示轻量加载遮罩', () => {
  assert.match(source, /new Worker\(new URL\('\.\.\/workers\/ziwei-display\.worker\.ts', import\.meta\.url\), \{/);
  assert.match(source, /const \[isDisplayPayloadLoading, setIsDisplayPayloadLoading\] = useState\(false\);/);
  assert.match(source, /className="ziwei-board-loading-mask"/);
  assert.match(source, /<ZiweiBoardSkeleton/);
});
