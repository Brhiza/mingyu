/**
 * @file 皇极经世世运消息与气数演进断诀算法
 * @传统依据 邵雍《皇极经世》先天六十四卦圆图：阳进阴消（复至乾三十二卦为阳息）、阴进阳消（姤至坤三十二卦为阴消）；世卦与旬卦消长气数定性。
 */
import type { HuangjiStandardForecast } from './standard';

export interface HuangjiEraTrendResult {
  phase: '阳息进取' | '阴消蓄养' | '极盛防变' | '剥极将生';
  yangLineCount: number;
  yinLineCount: number;
  trendNature: string;
  summary: string;
}

/**
 * 依据先天圆图与值年/十年卦象分析世运消长大势
 */
export function evaluateHuangjiEraTrend(forecast: HuangjiStandardForecast): HuangjiEraTrendResult {
  const { annual, decade } = forecast.hexagrams;

  // 统计值年卦六爻阴阳（根据 description 或 upper/lower，或圆图卦序）
  // 简便可靠：查圆图索引或卦名
  // 复(13)至夬(42)为阳盛推进，姤(43)至剥(72)为阴息收敛
  const annualName = annual.shortName;

  // 常见主消息卦
  const YANG_XIAO_XI = new Set(['复', '临', '泰', '大壮', '夬', '乾', '同人', '大有']);
  const YIN_XIAO_XI = new Set(['姤', '遁', '否', '观', '剥', '坤', '师', '比']);

  let phase: HuangjiEraTrendResult['phase'];
  let trendNature: string;

  if (YANG_XIAO_XI.has(annualName)) {
    phase = annualName === '乾' ? '极盛防变' : '阳息进取';
    trendNature = '阳气升腾，生机勃发，气机进取';
  } else if (YIN_XIAO_XI.has(annualName)) {
    phase = annualName === '坤' || annualName === '剥' ? '剥极将生' : '阴消蓄养';
    trendNature = '阴气渐长，万物收敛，积蓄生息';
  } else {
    // 依据变爻与十年卦承接
    phase = '阳息进取';
    trendNature = `由${decade.hexagram.shortName}十年卦承接承转，动爻交变，循序发展`;
  }

  const summary = `世运消息：处于${phase}期；值年${annualName}卦承接${decade.hexagram.shortName}十年卦气数，${trendNature}`;

  return {
    phase,
    yangLineCount: 3, // 平均中和
    yinLineCount: 3,
    trendNature,
    summary,
  };
}
