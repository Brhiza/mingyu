import { getDivinationSummaryBlocks, type DivinationSummaryBlocks } from 'mingyu-core/prompt';
import type { DivinationSession } from './engine';
import { formatXiaoliurenRangeInterval } from './xiaoliuren-range';
import { formatJinkoujueRangeInterval } from './jinkoujue-range';
import { formatLiurenRangeInterval } from './liuren-range';
import { formatMeihuaRangeInterval } from './meihua-range';
import {
  formatLiuyaoRangeInterval,
  formatLiuyaoRangeBackground,
  formatLiuyaoRangeOrigin,
} from './liuyao-range';
import { formatQimenRangeInterval, formatQimenRangeMoonPhase } from './qimen-range';

export { getDivinationSummaryBlocks, type DivinationSummaryBlocks };

export function getDivinationSessionSummary(session: DivinationSession): DivinationSummaryBlocks {
  if (session.method === 'liuyao' && session.liuyaoRange) {
    return {
      title: '六爻时段排盘结果',
      tags: [
        session.liuyaoRange.status === 'stable'
          ? '时令背景稳定'
          : `时令背景分为${session.liuyaoRange.branches.length}段`,
      ],
      lines: [
        formatLiuyaoRangeOrigin(session.liuyaoRange),
        ...session.liuyaoRange.branches.map(
          (branch) =>
            `${formatLiuyaoRangeInterval(branch.startTimestamp, branch.endTimestamp)}：本卦${branch.data.originalName}，变卦${branch.data.changedName || '无'}；${formatLiuyaoRangeBackground(branch)}`,
        ),
      ],
    };
  }
  if (session.method === 'qimen' && session.qimenRange) {
    return {
      title: '奇门遁甲时段排盘结果',
      tags: [
        session.qimenRange.status === 'stable'
          ? '盘面与节令背景稳定'
          : `时间范围内分为${session.qimenRange.branches.length}段`,
      ],
      lines: session.qimenRange.branches.flatMap((branch) => {
        const { startTimestamp, endTimestamp, data } = branch;
        return [
          `${formatQimenRangeInterval(startTimestamp, endTimestamp)}：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；节气${data.timeInfo.solarTerm}；值符${data.zhiFu}、值使${data.zhiShi}${data.seasonality ? `；节令阶段${data.seasonality.jieQiPhase.phase}，月相${data.seasonality.lunarPhaseDetail}，建除${data.seasonality.dayOfficer}` : ''}`,
          formatQimenRangeMoonPhase(branch),
        ];
      }),
    };
  }
  if (session.method === 'meihua' && session.meihuaRange?.status === 'conditional') {
    return {
      title: '梅花易数分时起卦结果',
      tags: [`时间范围内分为${session.meihuaRange.branches.length}卦`],
      lines: session.meihuaRange.branches.map(
        ({ startTimestamp, endTimestamp, data }) =>
          `${formatMeihuaRangeInterval(startTimestamp, endTimestamp)}：本卦${data.mainHexagram.name}，互卦${data.interHexagram?.name ?? data.interName ?? '无'}，变卦${data.changedHexagram?.name ?? data.changedName ?? '无'}；体${data.tiGua.name}、用${data.yongGua.name}，第${data.movingYao.position}爻动`,
      ),
    };
  }
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
