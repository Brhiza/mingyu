import { qizhengRangeInput } from './schema';
import { assertRangePage, collectRangePages } from './range-client';
export { mergeRangeMetric } from './range-client';
import { qizhengRangeFingerprint, qizhengRangeSamples, renderQizhengRange, type QizhengRangeData, type QizhengRangeInput } from './systems/qizheng-range';

function assertPage(page: QizhengRangeData, input: QizhengRangeInput, cursor: number) {
  assertRangePage(page, input, cursor, {
    defaultPageSize: input.periodEvents ? 1 : 30,
    inputKeys: ['birth', 'prompt', 'flow', 'gender', 'periodEvents'],
    timestampOf: (chart) => chart?.basis?.utcTimestamp,
    fingerprint: qizhengRangeFingerprint,
    samples: qizhengRangeSamples,
  });
}
/** 按顺序获取全部页面并合并；收集器检查覆盖及字段一致性，不证明服务返回的内容真实。 */
export async function collectQizhengRange(
  source: unknown,
  fetchPage: (input: QizhengRangeInput, signal?: AbortSignal) => Promise<QizhengRangeData>,
  options: { signal?: AbortSignal; onProgress?: (completed: number, total: number) => void; yieldControl?: () => Promise<void> } = {},
) {
  const input = qizhengRangeInput.parse(source);
  const { lastPage, branches } = await collectRangePages(input, fetchPage, assertPage, options);
  const data: QizhengRangeData = { ...lastPage, input: { birth: input.birth, range: input.range, ...(input.gender ? { gender: input.gender } : {}), ...(input.flow ? { flow: input.flow } : {}), ...(input.periodEvents !== undefined ? { periodEvents: input.periodEvents } : {}), ...(input.prompt ? { prompt: input.prompt } : {}) },
    range: { ...lastPage.range, startIndex: 0, endIndex: lastPage.range.totalSeconds, complete: true, nextCursor: null }, branches,
    limitation: `已按整秒覆盖完整区间；连续指标为采样最小最大值。圆周指标从首值开始逐秒展开，可能超出 0–360。${input.periodEvents ? '周期事件仅覆盖结果列出的星曜与相位；时间范围为出生采样所得最小值和最大值。' : '流曜仅为指定瞬时，未扫描周期事件。'}收集器只校验分页一致性，不证明来源真实性。` };
  return { data, summary: { title: '七政四余出生范围（完整收集）', lines: [`完整覆盖 ${data.range.totalSeconds} 秒`, `连续分支：${branches.length}`] }, prompt: renderQizhengRange(data, input.question, input.prompt) };
}
