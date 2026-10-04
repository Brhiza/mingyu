import { isKe, isSheng } from '../../../../ganzhi';

/** 动爻、体用与月令只给相对触发条件，不换算固定日期。 */
export function estimateYingQi(params: {
  movingYaoIndex: number;
  tiElement: string;
  yongElement: string;
  seasonState: '旺' | '相' | '休' | '囚' | '死' | '平';
}): string[] {
  const periods: string[] = [];
  const { movingYaoIndex, tiElement, yongElement, seasonState } = params;
  const yaoPeriodMap: Record<number, string> = {
    1: '初爻动，先观察事情刚开始或基层条件的变化',
    2: '二爻动，先观察内部配合与近端条件的变化',
    3: '三爻动，先观察由内向外过渡时的变化',
    4: '四爻动，先观察外部环境开始介入时的变化',
    5: '五爻动，先观察核心决策与主导条件的变化',
    6: '上爻动，先观察事情末端、退出或重新定局的变化',
  };
  periods.push(yaoPeriodMap[movingYaoIndex] || '触发层位须结合实际事件再验');

  if (yongElement === tiElement) {
    periods.push('体用比和，关系同气，可优先观察条件同步时的进展');
  } else if (isSheng(yongElement, tiElement)) {
    periods.push('用生体，外部条件对体卦有生扶，可观察助力实际出现时的进展');
  } else if (isKe(yongElement, tiElement)) {
    periods.push('用克体，外部事项对体卦形成压力，须先观察阻力是否缓解');
  } else if (isKe(tiElement, yongElement)) {
    periods.push('体克用，体卦能够制约事项，但须核验投入和消耗是否可承受');
  } else if (isSheng(tiElement, yongElement)) {
    periods.push('体生用，体卦向事项泄气，可观察投入消耗与恢复条件');
  }

  if (seasonState === '旺' || seasonState === '相') {
    periods.push(`体卦月令${seasonState}，可作应期偏快的盘内参考`);
  } else if (seasonState === '休' || seasonState === '囚' || seasonState === '死') {
    periods.push(`体卦月令${seasonState}，可作应期偏缓的盘内参考`);
  }
  return periods;
}
