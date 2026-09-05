import type { XiaoliurenRule } from '../types/divination';

export const XIAOLIUREN_RULE_OPTIONS = [
  { value: 'common', label: '通行掌诀' },
  { value: 'duoneng', label: '《多能鄙事》' },
] as const;

export function resolveXiaoliurenRule(rule: XiaoliurenRule = 'common') {
  if (rule !== 'common' && rule !== 'duoneng') {
    throw new Error('小六壬起课口径必须是通行掌诀或《多能鄙事》');
  }
  return rule === 'duoneng'
    ? {
        id: rule,
        label: '《多能鄙事》',
        dayStartOffset: 1,
        source:
          '《多能鄙事》卷八“小六壬课时”：正月初一留连，二月初一速喜；日宫起子时，依大安、留连、速喜、赤口、小吉、空亡顺行',
      }
    : {
        id: rule,
        label: '通行掌诀',
        dayStartOffset: 0,
        source:
          '通行俗传小六壬掌诀：正月从大安起，月上起初一，日上起子时，依大安、留连、速喜、赤口、小吉、空亡顺行',
      };
}

// 《多能鄙事》卷八，小六壬课时；上海本扫描第196—197页。
export const DUONENG_XIAOLIUREN_VERSES = [
  '大安时青龙主事，百事吉，失物在，行人未动。',
  '留连时玄武主事，凡事难成，求谋日未明，官事只可缓，去者未回程，失物巽上见，急讨方称情，更须防口舌，人口且平平。',
  '速喜时朱雀用事，有喜即至，行人来，公事了，失物离上可觅见。',
  '赤口时白虎用事，有口舌官灾，行人有惊，病者重，有咒咀，失物有争。',
  '小吉时六合主事，去行人至，失物坤方寻得，交关宜利。',
  '空亡时勾陈主事，求财无利，行人有灾，失物难觅，百事无成。',
] as const;
