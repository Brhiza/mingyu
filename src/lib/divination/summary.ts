import { getDivinationSummaryBlocks, type DivinationSummaryBlocks } from 'mingyu-core/prompt';
import type { DivinationSession } from './engine';
import { formatXiaoliurenRangeInterval } from './xiaoliuren-range';
import { formatJinkoujueRangeInterval } from './jinkoujue-range';
import { formatLiurenRangeInterval } from './liuren-range';

export { getDivinationSummaryBlocks, type DivinationSummaryBlocks };

export function getDivinationSessionSummary(session: DivinationSession): DivinationSummaryBlocks {
  if (session.method === 'jinkoujue' && session.jinkoujueRange?.status === 'conditional') {
    return {
      title: '金口诀分时起课结果',
      tags: [`时间范围内分为${session.jinkoujueRange.branches.length}课`],
      lines: session.jinkoujueRange.branches.map(
        ({ startTimestamp, endTimestamp, data }) =>
          `${formatJinkoujueRangeInterval(startTimestamp, endTimestamp)}：月将${data.monthLeader}；${data.mainLine}`,
      ),
    };
  }

  if (session.method === 'liuren' && session.liurenRange?.status === 'conditional') {
    return {
      title: '大六壬分时起课结果',
      tags: [`时间范围内分为${session.liurenRange.branches.length}课`],
      lines: session.liurenRange.branches.map(
        ({ startTimestamp, endTimestamp, data }) =>
          `${formatLiurenRangeInterval(startTimestamp, endTimestamp)}：月将${data.monthLeader}；四课${data.fourLessons.map((lesson) => `${lesson.upper}临${lesson.lower}`).join('、')}；三传${data.threeTransmissions.map((item) => item.branch).join('→')}`,
      ),
    };
  }
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
