/**
 * 先天圆图阴阳半周与值年卦爻数。
 * 《朱子语类》卷六十五：复至乾属阳，姤至坤属阴；内卦震离兑乾与巽坎艮坤分列两边。
 */
import { hexagramsData } from '../divination/hexagram-data';
import type { HuangjiStandardForecast } from './standard';

export interface HuangjiEraTrendResult {
  /** 圆图消息象意分类。 */
  phase: '阳息进取' | '阴消蓄养' | '极盛防变' | '剥极将生';
  yangLineCount: number;
  yinLineCount: number;
  trendNature: string;
  summary: string;
}

/** 按值年卦的真实六爻与圆图所属半周整理消息象意。 */
export function evaluateHuangjiEraTrend(forecast: HuangjiStandardForecast): HuangjiEraTrendResult {
  const annual = forecast?.hexagrams?.annual;
  const hexagram = hexagramsData.find((item) => item.id === annual?.id);
  if (!annual || !hexagram) throw new Error('值年卦资料无效。');
  const annualName = hexagram.upper === hexagram.lower ? hexagram.upper : hexagram.name.slice(2);
  if (
    annual.name !== hexagram.name ||
    annual.shortName !== annualName ||
    annual.upper !== hexagram.upper ||
    annual.lower !== hexagram.lower
  )
    throw new Error('值年卦名称与卦画资料不一致。');

  const yangLineCount = [...hexagram.binarySymbol].filter((line) => line === '1').length;
  const yinLineCount = 6 - yangLineCount;
  // binarySymbol先上卦后下卦，每个经卦自下而上；第4位为重卦初爻。
  const yangHalf = hexagram.binarySymbol[3] === '1';
  const half = yangHalf ? '复至乾的阳半周' : '姤至坤的阴半周';
  let phase: HuangjiEraTrendResult['phase'];
  let trendNature: string;
  if (annualName === '乾') {
    phase = '极盛防变';
    trendNature = '六爻纯阳，处于圆图阳半周终点，取阳极阴生之象';
  } else if (annualName === '坤' || annualName === '剥') {
    phase = '剥极将生';
    trendNature =
      annualName === '坤'
        ? '六爻纯阴，处于圆图阴半周终点，取阴极阳生之象'
        : '五阴在下、一阳在上，处于圆图阴半周近末，取剥尽而复之象';
  } else {
    phase = yangHalf ? '阳息进取' : '阴消蓄养';
    trendNature = `初爻为${yangHalf ? '阳' : '阴'}，属于${half}，取${yangHalf ? '阳息' : '阳消阴长'}之象`;
  }

  return {
    phase,
    yangLineCount,
    yinLineCount,
    trendNature,
    summary: `圆图消息：值年${annualName}卦为${yangLineCount}阳${yinLineCount}阴；${trendNature}。`,
  };
}
