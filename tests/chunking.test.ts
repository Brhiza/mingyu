import test from 'node:test';
import assert from 'node:assert/strict';
import { getManualChunk } from '../build/chunking';

test('React 与路由依赖会进入基础 vendor 分块', () => {
  assert.equal(getManualChunk('D:/project/node_modules/react-dom/client.js'), 'react-vendor');
  assert.equal(
    getManualChunk('D:/project/node_modules/react-router-dom/dist/index.mjs'),
    'router-vendor',
  );
});

test('命理核心模块会进入统一计算分块，避免八字与紫微互相引用时产生循环分块', () => {
  assert.equal(getManualChunk('D:/project/node_modules/iztro/lib/index.js'), 'iztro-vendor');
  assert.equal(getManualChunk('D:/project/node_modules/tyme4ts/dist/index.js'), 'tyme-vendor');
  assert.equal(
    getManualChunk('D:/project/packages/core/src/ziwei/iztro/runtime-helpers.ts'),
    'chart-engine',
  );
  assert.equal(getManualChunk('D:/project/src/lib/full-chart-engine/ziwei.ts'), 'chart-engine');
  assert.equal(getManualChunk('D:/project/src/lib/full-chart-engine/bazi.ts'), 'chart-engine');
  assert.equal(
    getManualChunk('D:/project/packages/core/src/bazi/baziCalculator.ts'),
    'chart-engine',
  );
});

test('八字运势面板相关模块会进入独立异步分块', () => {
  assert.equal(
    getManualChunk('D:/project/src/components/BaziFortuneTools/BaziFortuneSelector.tsx'),
    'bazi-fortune-ui',
  );
  assert.equal(
    getManualChunk('D:/project/src/components/BaziFortuneTools/BaziFortuneModal.tsx'),
    'bazi-fortune-ui',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/src/bazi/calendarTool.ts'),
    'chart-engine',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/src/bazi/fortuneSelection/index.ts'),
    'chart-engine',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/src/bazi/fortuneModalSelection.ts'),
    'chart-engine',
  );
});

test('提示词生成模块会进入 prompt-engine 分块', () => {
  assert.equal(getManualChunk('D:/project/src/utils/ai/aiPromptBuilder.ts'), 'prompt-engine');
  assert.equal(getManualChunk('D:/project/src/lib/prompt-engine.ts'), 'prompt-engine');
});

test('无关模块保持默认分块策略', () => {
  assert.equal(getManualChunk('D:/project/src/pages/InputPage.tsx'), undefined);
  assert.equal(getManualChunk('D:/project/src/lib/templates.ts'), undefined);
  assert.equal(getManualChunk('D:/project/src/lib/synastry-prompts.ts'), undefined);
});
