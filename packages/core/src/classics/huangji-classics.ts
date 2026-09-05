import type { HuangjiCycleClassic } from './types';

/** 张行成《皇极经世索隐·经世观物总要》的周期原文与释义。 */
export const HUANGJI_CYCLE_CLASSICS: Record<string, HuangjiCycleClassic> = {
  元: {
    cycleType: '元',
    name: '元 · 十二万九千六百年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '总一元有十二会、三百六十运、四千三百二十世。',
    principle: '一元由十二会组成，合三百六十运、四千三百二十世，共十二万九千六百年。',
    modernAdvice: '结合所取纪元，定位当前会、运、世在一元中的层次。',
  },
  会: {
    cycleType: '会',
    name: '会 · 一万零八百年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '月为会，自子至亥分十二会。星为运，自甲至癸凡三周，得三十运，为一会。',
    principle: '一会包含三十运，合一万零八百年；十二会以十二地支依次命名。',
    modernAdvice: '先辨所处会次及其起止，再阅读会内的运、世位置。',
  },
  运: {
    cycleType: '运',
    name: '运 · 三百六十年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '辰为世，自子至亥一周得十二世为一运。',
    principle: '一运包含十二世，每世三十年，合三百六十年。',
    modernAdvice: '把当前世次放回所属运的起止范围，比较前后周期位置。',
  },
  世: {
    cycleType: '世',
    name: '世 · 三十年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '三十年为一世，则一运得三百六十年，一会得一万八百年，一元得一十二万九千六百年。',
    principle: '世是三十年的计数层级；十二世积为一运。',
    modernAdvice: '结合本世起止年，辨明目标年在三十年周期中的位置。',
  },
  年: {
    cycleType: '年',
    name: '年 · 经世层次',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '会之用至年，故以会经运，始书年。',
    principle: '原文说明经世记年与会、运层次的关系。',
    modernAdvice: '阅读值年卦时，结合本次所取年序和上层周期共同理解。',
  },
};

export function getHuangjiCycleClassic(cycle: string): HuangjiCycleClassic | undefined {
  if (typeof cycle !== 'string' || !Object.hasOwn(HUANGJI_CYCLE_CLASSICS, cycle)) return undefined;
  return { ...HUANGJI_CYCLE_CLASSICS[cycle] };
}
