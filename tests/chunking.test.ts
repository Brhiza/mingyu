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

test('八字与紫微核心模块分别分块，避免单个计算包过大', () => {
  assert.equal(getManualChunk('D:/project/node_modules/iztro/lib/index.js'), 'iztro-vendor');
  assert.equal(getManualChunk('D:/project/node_modules/tyme4ts/dist/index.js'), 'tyme-vendor');
  assert.equal(
    getManualChunk('D:/project/packages/core/src/ziwei/iztro/runtime-helpers.ts'),
    'ziwei-engine',
  );
  assert.equal(getManualChunk('D:/project/src/lib/full-chart-engine/ziwei.ts'), 'ziwei-engine');
  assert.equal(getManualChunk('D:/project/src/lib/full-chart-engine/bazi.ts'), 'bazi-engine');
  assert.equal(
    getManualChunk('D:/project/packages/core/src/bazi/baziCalculator.ts'),
    'bazi-engine',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/src/ziwei/iztro/pattern-detection.ts'),
    'ziwei-patterns',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/dist/ziwei/iztro/pattern-detection.js'),
    'ziwei-patterns',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/dist/ziwei/iztro/runtime-helpers.js'),
    'ziwei-engine',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/dist/bazi/baziCalculator.js'),
    'bazi-engine',
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
  assert.equal(getManualChunk('D:/project/packages/core/src/bazi/calendarTool.ts'), 'bazi-engine');
  assert.equal(
    getManualChunk('D:/project/packages/core/src/bazi/fortuneSelection/index.ts'),
    'bazi-engine',
  );
  assert.equal(
    getManualChunk('D:/project/packages/core/src/bazi/fortuneModalSelection.ts'),
    'bazi-engine',
  );
});

test('八字与紫微共用的历法和干支模块进入共享分块', () => {
  assert.equal(
    getManualChunk('D:/project/packages/core/dist/calendar/true-solar-time.js'),
    'core-shared',
  );
  assert.equal(getManualChunk('D:/project/packages/core/src/ganzhi/relations.ts'), 'core-shared');
  assert.equal(getManualChunk('D:/project/packages/core/dist/shared/result.js'), 'core-shared');
  assert.equal(getManualChunk('D:/project/src/lib/time-policy.ts'), 'chart-engine-shared');
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
