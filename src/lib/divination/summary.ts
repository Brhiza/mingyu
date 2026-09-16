import { getDivinationSummaryBlocks, type DivinationSummaryBlocks } from 'mingyu-core/prompt';
import type { DivinationSession } from './engine';
import { formatXiaoliurenRangeInterval } from './xiaoliuren-range';

export { getDivinationSummaryBlocks, type DivinationSummaryBlocks };

export function getDivinationSessionSummary(session: DivinationSession): DivinationSummaryBlocks {
  if (session.method !== 'xiaoliuren' || session.xiaoliurenRange?.status !== 'conditional') {
    return getDivinationSummaryBlocks(session.method, session.data);
  }
  return {
    title: '小六壬分时起课结果',
    tags: [`时间范围内分为${session.xiaoliurenRange.branches.length}课`],
    lines: session.xiaoliurenRange.branches.map(
      ({ startTimestamp, endTimestamp, data }) =>
        `${formatXiaoliurenRangeInterval(startTimestamp, endTimestamp)}：农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}；月宫${data.sequence.month.name}、日宫${data.sequence.day.name}、时宫${data.primary.name}`,
    ),
  };
}
