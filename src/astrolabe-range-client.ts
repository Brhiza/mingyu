import { astrolabeRangeInput } from './schema';
import { assertRangePage, collectRangePages } from './range-client';
import { astrolabeRangeFingerprint, astrolabeRangeSamples, renderAstrolabeRange, type AstrolabeRangeData, type AstrolabeRangeInput } from './systems/astrolabe-range';

function assertPage(page: AstrolabeRangeData, input: AstrolabeRangeInput, cursor: number) {
  assertRangePage(page, input, cursor, {
    defaultPageSize: input.flow ? 1 : 10,
    inputKeys: ['birth', 'options', 'flow', 'prompt'],
    timestampOf: (chart) => Date.parse(chart?.basis?.utcDateTime),
    fingerprint: astrolabeRangeFingerprint,
    samples: astrolabeRangeSamples,
  });
}

/** Collect and merge all pages; structural checks do not authenticate a remote service. */
export async function collectAstrolabeRange(source: unknown, fetchPage: (input: AstrolabeRangeInput, signal?: AbortSignal) => Promise<AstrolabeRangeData>,
  options: { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void; yieldControl?: () => Promise<void> } = {}) {
  const input = astrolabeRangeInput.parse(source);
  const { lastPage, branches } = await collectRangePages(input, fetchPage, assertPage, options);
  const data: AstrolabeRangeData = { ...lastPage, input: { birth: input.birth, range: input.range, ...(input.options ? { options: input.options } : {}), ...(input.flow ? { flow: input.flow } : {}), ...(input.prompt ? { prompt: input.prompt } : {}) },
    range: { ...lastPage.range, startIndex: 0, endIndex: lastPage.range.totalSeconds, complete: true, nextCursor: null }, branches,
    limitation: `已按整秒覆盖完整出生区间；首末盘为候选秒，不代表确定出生时刻。连续指标为逐秒采样最小值和最大值，圆周值按顺序展开，可能超出 0–360。${input.flow?.period ? '周期事件只覆盖当前周期页，事件时刻范围来自各出生秒采样。' : '未启用出生范围的周期事件扫描。'}收集器只校验分页一致性，不证明来源真实性。` };
  return { data, summary: { title: '西洋星盘出生范围（完整收集）', lines: [`完整覆盖 ${data.range.totalSeconds} 秒`, `连续分支：${branches.length}`] }, prompt: renderAstrolabeRange(data, input.question, input.prompt) };
}
