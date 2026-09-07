import type { HuangjiCycleClassic } from './types';

/**
 * 宋代邵雍《皇极经世书·观物篇》元会运世治乱卦气要旨
 */
export const HUANGJI_CYCLE_CLASSICS: Record<string, HuangjiCycleClassic> = {
  元: {
    cycleType: '元',
    name: '一元之象 · 十二万九千六百年',
    sourceBook: '皇极经世书·观物篇',
    verse: '一元统十二会，生息开阖成一世大乾坤。日生于子，月萌于丑，星散于寅，万物萌生。',
    principle: '天地大周期的终始轮回，涵盖人类文明与自然大化的开物与闭物。',
    modernAdvice: '立足最宏大的历史周期视角，顺应天道生生不息之自然规律。',
  },
  会: {
    cycleType: '会',
    name: '一会之象 · 一万零八百年',
    sourceBook: '皇极经世书·观物篇',
    verse: '三十运为一会，子丑寅卯辰巳午未申酉戌亥，配以先天八卦，各司万物开物闭物。',
    principle: '文明范式的大变迁，如午会正阳鼎盛，未会文明渐趋成熟。',
    modernAdvice: '洞察时代巨变脉络，把握大历史分水岭的趋势与时代命脉。',
  },
  运: {
    cycleType: '运',
    name: '一运之象 · 三百六十年',
    sourceBook: '皇极经世书·观物篇',
    verse: '十二世为一运，运卦司三百年政治、经济与文化潮流之起伏治乱。',
    principle: '朝代与大国政经周期的兴衰轮替，卦象揭示战略大环境的冷暖走向。',
    modernAdvice: '制定长周期战略目标，看清多代人交替所处的大运风向。',
  },
  世: {
    cycleType: '世',
    name: '一世之象 · 三十年',
    sourceBook: '皇极经世书·观物篇',
    verse: '三十年为一世，世卦主一代人之思想变迁、制度演进与社会风尚。',
    principle: '人生与社会一代人的黄金时代，决定产业变革与社会主流价值观。',
    modernAdvice: '把握三十年一代人的黄金窗口期，顺应产业转型与科技突破。',
  },
  年: {
    cycleType: '年',
    name: '值年卦象 · 当年气数',
    sourceBook: '皇极经世书·观物篇',
    verse: '年卦司岁气之机，六十四卦周流不息，揭示一岁之丰歉、通塞与机宜。',
    principle: '年度运势的宏观气场，结合卦象大象传与爻动指引具体行动方针。',
    modernAdvice: '根据当年值年卦象所主，审时度势，趋吉避凶，稳健经营。',
  },
};

export function getHuangjiCycleClassic(cycle: string): HuangjiCycleClassic | undefined {
  if (!cycle) return undefined;
  for (const [key, val] of Object.entries(HUANGJI_CYCLE_CLASSICS)) {
    if (cycle.includes(key)) return val;
  }
  return undefined;
}
