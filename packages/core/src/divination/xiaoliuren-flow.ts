/**
 * @file 小六壬初宫二宫三宫流转与终局定性断诀
 * @传统依据 《小六壬通占》《马前课》：月上起初一，日上起子时；初宫主事端起由，二宫主人事过渡，三宫（时宫）定局定性。
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
 * 推导小六壬月日时三宫流转与终局定性
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
    classicalJudgment = '起手虽逢淹留滞涩，得时宫吉曜化解，先难后易、终见转机。';
  } else if (
    (month.name === '大安' || month.name === '小吉' || month.name === '速喜') &&
    hour.name === '空亡'
  ) {
    trajectoryType = '始吉终空';
    classicalJudgment = '初念虽吉，历经转折归于空亡，须防虚花无实、防范虎头蛇尾。';
  } else if (
    (month.name === '大安' || month.name === '小吉' || month.name === '速喜') &&
    hour.name === '赤口'
  ) {
    trajectoryType = '转折相克';
    classicalJudgment = '事本吉昌，然归结临赤口金煞，谨防临门起口舌官非或争斗破耗。';
  } else if ((rel1 === '生出' || rel1 === '受生') && (rel2 === '生出' || rel2 === '受生')) {
    trajectoryType = '顺畅相生';
    classicalJudgment = '三宫五行相生有情，事态由萌芽至归结气脉顺遂，所谋易成。';
  } else if (rel1 === '比和' && rel2 === '比和') {
    trajectoryType = '平稳和合';
    classicalJudgment = '三宫同气比和，事态平稳少突变，宜顺应既定节奏稳步落实。';
  } else {
    trajectoryType = '起伏交错';
    classicalJudgment = `初宫${month.name}、二宫${day.name}、时宫${hour.name}，吉凶参半，以时宫为最终决疑准绳。`;
  }

  const summary = `【小六壬三宫流转】初宫${month.name}（${month.wuxing}）→ 二宫${day.name}（${day.wuxing}）→ 时宫${hour.name}（${hour.wuxing}），流转走势定性为「${trajectoryType}」。断诀：${classicalJudgment}`;

  return {
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
