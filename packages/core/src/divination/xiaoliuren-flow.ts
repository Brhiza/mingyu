/**
 * @file 小六壬三宫五行关系与组合分类
 * 六宫五行采用《大杂字万事不求人》民国三十五年本“李淳风六壬时课”，扫描第21—22页。
 * 组合类别为现代归类，不将月日时计数位置对应为现实事件的三个阶段。
 */
import { isKe, isSheng } from '../ganzhi';

export interface XiaoliurenPalaceInfo {
  name: string;
  wuxing: '木' | '火' | '土' | '金' | '水';
  auspice: '大吉' | '吉' | '小吉' | '平' | '凶';
}

export const XIAOLIUREN_PALACE_ATTRIBUTES: Record<string, XiaoliurenPalaceInfo> = {
  大安: { name: '大安', wuxing: '木', auspice: '大吉' },
  留连: { name: '留连', wuxing: '水', auspice: '平' },
  速喜: { name: '速喜', wuxing: '火', auspice: '吉' },
  赤口: { name: '赤口', wuxing: '金', auspice: '凶' },
  小吉: { name: '小吉', wuxing: '木', auspice: '小吉' },
  空亡: { name: '空亡', wuxing: '土', auspice: '凶' },
};

function elementRelation(source: string, target: string): string {
  if (source === target) return '比和';
  if (isSheng(source, target)) return '生出';
  if (isSheng(target, source)) return '受生';
  return isKe(source, target) ? '克出' : '受克';
}

function resolvePalace(name: string): XiaoliurenPalaceInfo {
  if (typeof name !== 'string' || !Object.hasOwn(XIAOLIUREN_PALACE_ATTRIBUTES, name)) {
    throw new Error(`未知的小六壬宫名：${name}`);
  }
  return { ...XIAOLIUREN_PALACE_ATTRIBUTES[name] };
}

export interface XiaoliurenFlowResult {
  interpretationBasis: '现代组合分类';
  month: XiaoliurenPalaceInfo;
  day: XiaoliurenPalaceInfo;
  hour: XiaoliurenPalaceInfo;
  monthToDayRelation: string;
  dayToHourRelation: string;
  trajectoryType: '顺畅相生' | '转折相克' | '先滞后发' | '始吉终空' | '平稳和合' | '起伏交错';
  classicalJudgment: string;
  summary: string;
}

/**
 * 比较三宫五行关系并按宫名组合归类。
 */
export function evaluateXiaoliurenFlow(sequence: {
  monthName: string;
  dayName: string;
  hourName: string;
}): XiaoliurenFlowResult {
  if (!sequence || typeof sequence !== 'object' || Array.isArray(sequence)) {
    throw new Error('小六壬三宫输入必须是对象');
  }
  const month = resolvePalace(sequence.monthName);
  const day = resolvePalace(sequence.dayName);
  const hour = resolvePalace(sequence.hourName);

  const rel1 = elementRelation(month.wuxing, day.wuxing);
  const rel2 = elementRelation(day.wuxing, hour.wuxing);

  let trajectoryType: XiaoliurenFlowResult['trajectoryType'];
  let classicalJudgment: string;

  if (
    month.name === '留连' &&
    (hour.name === '速喜' || hour.name === '大安' || hour.name === '小吉')
  ) {
    trajectoryType = '先滞后发';
    classicalJudgment = `月宫留连，时宫${hour.name}；该类别按两宫名称组合归类。`;
  } else if (
    (month.name === '大安' || month.name === '小吉' || month.name === '速喜') &&
    hour.name === '空亡'
  ) {
    trajectoryType = '始吉终空';
    classicalJudgment = `月宫${month.name}，时宫空亡；该类别按两宫名称组合归类。`;
  } else if (
    (month.name === '大安' || month.name === '小吉' || month.name === '速喜') &&
    hour.name === '赤口'
  ) {
    trajectoryType = '转折相克';
    classicalJudgment = `月宫${month.name}，时宫赤口；该类别按两宫名称组合归类。`;
  } else if ((rel1 === '生出' || rel1 === '受生') && (rel2 === '生出' || rel2 === '受生')) {
    trajectoryType = '顺畅相生';
    classicalJudgment = '月日两宫与日时两宫均构成相生关系。';
  } else if (rel1 === '比和' && rel2 === '比和') {
    trajectoryType = '平稳和合';
    classicalJudgment = '月、日、时三宫五行相同，均为比和关系。';
  } else {
    trajectoryType = '起伏交错';
    classicalJudgment = `月日关系${rel1}，日时关系${rel2}。`;
  }

  const summary = `【小六壬三宫流转】月宫${month.name}（${month.wuxing}）→ 日宫${day.name}（${day.wuxing}）→ 时宫${hour.name}（${hour.wuxing}），现代组合分类「${trajectoryType}」。${classicalJudgment}`;

  return {
    interpretationBasis: '现代组合分类',
    month,
    day,
    hour,
    monthToDayRelation: `初宫${month.name}对二宫${day.name}：${rel1}`,
    dayToHourRelation: `二宫${day.name}对时宫${hour.name}：${rel2}`,
    trajectoryType,
    classicalJudgment,
    summary,
  };
}
