import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AstrolabeDynamicRangePanel } from '../src/pages/ResultPage/components/AstrolabeDynamicRangePanel';
import type { useAstrolabeDynamicRange } from '../src/hooks/useAstrolabeDynamicRange';
import { PromptWorkbenchPanel } from '../src/components/PromptPreview';
import { AstrolabeDynamicPromptPanel } from '../src/pages/ResultPage/components/AstrolabeDynamicPromptPanel';

type State = ReturnType<typeof useAstrolabeDynamicRange>;
const start = Date.parse('2024-03-20T11:00:00+08:00');
function state(overrides: Partial<State> = {}): State {
  return {
    key: '公开合成界面验证',
    loading: true,
    paused: true,
    error: null,
    summary: null,
    branches: Array.from({ length: 18 }, (_, index) => ({
      index,
      startTimestamp: start + index * 1000,
      endTimestamp: start + (index + 1) * 1000,
      sampleCount: 1,
      compressedBytes: 100,
    })),
    progress: { completed: 18, total: 120 },
    start() {},
    cancel() {},
    continueCalculation() {},
    async readBranch() {
      throw new Error('服务端初始渲染不应读取分段详情。');
    },
    ...overrides,
  };
}

test('动态区间首次渲染最多列出八个分段，详情按需读取', () => {
  const html = renderToStaticMarkup(createElement(AstrolabeDynamicRangePanel, { state: state() }));
  assert.equal((html.match(/aria-pressed=/gu) ?? []).length, 8);
  assert.match(html, /第 1 \/ 3 页/u);
  assert.match(html, /正在读取当前分段/u);
  assert.match(html, /继续一批/u);
  assert.match(html, /计算剩余全部/u);
  assert.match(html, /当前资料仅覆盖已完成部分/u);
  assert.doesNotMatch(html, /已完整核对/u);
  assert.doesNotMatch(html, /准备第一页资料/u);
});

test('取消后保留已完成分段并明确未完成，允许重新核对', () => {
  const html = renderToStaticMarkup(
    createElement(AstrolabeDynamicRangePanel, {
      state: state({ loading: false, paused: false, error: '已停止西占动态区间计算。' }),
    }),
  );
  assert.match(html, /重新核对/u);
  assert.match(html, /已停止西占动态区间计算/u);
  assert.match(html, /已核对 18 \/ 120 秒/u);
  assert.doesNotMatch(html, /<button[^>]*>(继续一批|计算剩余全部)<\/button>|已完整核对/u);
});

test('完整性提示只在取得最终汇总后显示', () => {
  const html = renderToStaticMarkup(
    createElement(AstrolabeDynamicRangePanel, {
      state: state({
        loading: false,
        paused: false,
        summary: {
          coverage: 'natal+dynamic',
          scope: 'full',
          referenceDate: '2028-03-20',
          status: 'conditional',
          source: {
            startTimestamp: start,
            endTimestamp: start + 18000,
            endExclusive: true,
            timezone: 'Asia/Shanghai',
            offsetHours: 8,
          },
          resolutionSeconds: 1,
          sampleCount: 18,
          branchCount: 18,
        },
      }),
    }),
  );
  assert.match(html, /已完整核对 18 秒，共 18 段/u);
  assert.doesNotMatch(html, /当前资料仅覆盖已完成部分/u);
});

test('提示词区域采用分页入口时不再渲染空的全量复制按钮', () => {
  const summary: NonNullable<State['summary']> = {
    coverage: 'natal+dynamic',
    scope: 'daily',
    referenceDate: '2028-03-20',
    status: 'stable',
    source: {
      startTimestamp: start,
      endTimestamp: start + 1000,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
    resolutionSeconds: 1,
    sampleCount: 1,
    branchCount: 1,
  };
  const html = renderToStaticMarkup(
    createElement(PromptWorkbenchPanel, {
      promptText: '',
      copyState: '暂无内容',
      shareState: '暂无内容',
      onCopy() {},
      onShare() {},
      children: createElement('label', null, '输入问题'),
      pagedPreview: createElement(AstrolabeDynamicPromptPanel, {
        summary,
        readBranch: state().readBranch,
      }),
    }),
  );
  assert.match(html, /准备第一页资料/u);
  assert.match(html, /每页最多 6000 字符/u);
  assert.match(html, /输入问题/u);
  assert.doesNotMatch(html, /暂无内容|正在整理提问内容/u);
});
