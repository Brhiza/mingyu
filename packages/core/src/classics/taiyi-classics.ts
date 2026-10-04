import type { TaiyiGeneralClassic } from './types';

/**
 * 《太乙金镜式经》《太乙统宗宝鉴》太乙神数诸神与八将精解
 */
export const TAIYI_GENERAL_CLASSICS: Record<string, TaiyiGeneralClassic> = {
  太乙: {
    general: '太乙',
    role: '监将 · 统领式局',
    wuxing: '木',
    sourceBook: '太乙金镜式经·卷二·推五将所主法',
    verse:
      '五将者，太乙监将，并上下二目，主客大小将也。监将者，东方岁星之精，受木德之正气，王在春三月。',
    nature: '式局以太乙象人君，与二目、主客将参共同构成定位和判断关系。',
    actionAdvice: '先辨太乙行宫，再合看二目、将参与岁时旺相。',
  },
  文昌: {
    general: '文昌',
    role: '下目 · 属主',
    wuxing: '土',
    sourceBook: '太乙金镜式经·卷二·推五将所主法',
    verse: '下目者，中宫镇星之精，受土德之正气，在地为阴，号文昌将，属主，王在四季。',
    nature: '下目属主，取中宫土德、四季旺相之象。',
    actionAdvice: '核对文昌所临位置与主算、主将，再结合岁时旺相取义。',
  },
  始击: {
    general: '始击',
    role: '上目 · 属客',
    wuxing: '火',
    sourceBook: '太乙金镜式经·卷二·推五将所主法',
    verse: '上目者，南方荧惑之精，受火德之正气，在天为阳，号始击将，属客，王在夏三月。',
    nature: '上目属客，取南方火德、夏季旺相之象。',
    actionAdvice: '核对始击所临位置与客算、客将，再结合岁时旺相取义。',
  },
  主将: {
    general: '主将',
    role: '主方大将',
    wuxing: '金',
    sourceBook: '太乙金镜式经·卷二·推五将所主法',
    verse: '主大将者，西方太白之精，受金德之正气，主战斗，王在秋三月。',
    nature: '主方大将，取西方金德、秋季旺相之象。',
    actionAdvice: '结合主算、主大将落宫与主参将位置核对盘面关系。',
  },
  客将: {
    general: '客将',
    role: '客方大将',
    wuxing: '水',
    sourceBook: '太乙金镜式经·卷二·推五将所主法',
    verse: '客大将者，北方辰星之精，受水德之正气，主兵革，王在冬三月。',
    nature: '客方大将，取北方水德、冬季旺相之象。',
    actionAdvice: '结合客算、客大将落宫与客参将位置核对盘面关系。',
  },
  主参: {
    general: '主参',
    role: '主方参将',
    sourceBook: '古今图书集成·艺术典第六百八十七卷·太乙淘金歌·求参将宫',
    verse:
      '由天地二目所数，主客二大将，三因，乃为主客二参将。如大将在三宫而三因之，则参将在九宫也。',
    nature: '主方参将，由主大将宫数三乘取余定位，与主大将共同参与关囚格迫判断。',
    actionAdvice: '结合主大将与主参将的落宫关系，审视主方配合与受制之处。',
  },
  客参: {
    general: '客参',
    role: '客方参将',
    sourceBook: '古今图书集成·艺术典第六百八十七卷·太乙淘金歌·求参将宫',
    verse:
      '由天地二目所数，主客二大将，三因，乃为主客二参将。如大将在三宫而三因之，则参将在九宫也。',
    nature: '客方参将，由客大将宫数三乘取余定位，与客大将共同参与关囚格迫判断。',
    actionAdvice: '结合客大将与客参将的落宫关系，审视客方配合与受制之处。',
  },
  计神: {
    general: '计神',
    role: '岁星之使 · 岁计枢机',
    sourceBook: '古今图书集成·艺术典第六百八十七卷·太乙淘金歌·求计神',
    verse:
      '计神者，岁星之使也。图计之宿，为太乙烛笼，用以筹度军国动静，主客胜负，为二目之首，四将之源。',
    nature: '依本计干支定位，并与文昌共同推定始击，是主客计算的前置位置。',
    actionAdvice: '按所用年、月、日、时计核对计神，再推二目与主客算。',
  },
};

export function getTaiyiGeneralClassic(general: string): TaiyiGeneralClassic | undefined {
  if (!general) return undefined;
  for (const [key, val] of Object.entries(TAIYI_GENERAL_CLASSICS)) {
    if (general.includes(key)) return structuredClone(val);
  }
  return undefined;
}
