import type { JinkoujueMovement } from '../types/divination';
import type { JinkoujueMovementClassic } from './types';

/**
 * 《六壬神课金口诀》卷之上“阴阳次第五用”“五动爻诵”“三动”原文节录。
 */
export const JINKOUJUE_MOVEMENT_CLASSICS: Record<
  JinkoujueMovement['name'],
  JinkoujueMovementClassic
> = {
  妻动: {
    key: '妻动',
    name: '妻动（上克下）',
    category: '五动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse:
      '妻动于妻妾；官财防损折；占人人在家；访人人不悦；外边来索取；卑下有口舌；论物多翻正；下旁或有缺。',
    modernAdvice: '原文以妻妾为事类，并记官财损折及上下、内外应象。',
  },
  官动: {
    key: '官动',
    name: '官动（下克上）',
    category: '五动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse:
      '官动利求官；相逢禄位迁；常人公府事；有官望财难；合得官中物；休从外处干；得财防暗损；问病在喉咽。',
    modernAdvice: '原文记求官、禄位与公府之事，并提示有官望财难。',
  },
  贼动: {
    key: '贼动',
    name: '贼动（上克下）',
    category: '五动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse:
      '贼动内贼生；勾连诈不明；损财卑幼病；谋望必无成；架媾奸私意；偷攘宛转名；卦爻终暗昧；病恐亦非轻。',
    modernAdvice: '原文记内财受克、失盗、奸私与暗昧等象。',
  },
  财动: {
    key: '财动',
    name: '财动（下克上）',
    category: '五动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse:
      '财动利求财；占官定不谐；家中人出外；妻妾并身灾；疾病忧难瘥；营求喜自来；财物终有损；职位恐多乖。',
    modernAdvice: '原文记求财、营求之象，同时指出官位与财物受损。',
  },
  鬼动: {
    key: '鬼动',
    name: '鬼动（下克上）',
    category: '五动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse:
      '鬼动忧灾怪；官亨人出外；争讼带他人；乖戾因间外；口舌共喧争；冤仇皆损害；痊病物仰合；家宅未安泰。',
    modernAdvice: '原文记灾怪、争讼、口舌与家宅不宁等象。',
  },
  父母动: {
    key: '父母动',
    name: '父母动（下生上）',
    category: '三动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse: '方生干为父母动：为印绶，凡占，小干尊，大吉。',
    modernAdvice: '原文称父母动为印绶，并断小干尊、大吉。',
  },
  子孙动: {
    key: '子孙动',
    name: '子孙动（上生下）',
    category: '三动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse: '干生方为子孙动：凡占，主干子孙之事，小吉。',
    modernAdvice: '原文主子孙之事，断小吉。',
  },
  兄弟动: {
    key: '兄弟动',
    name: '兄弟动（比和）',
    category: '三动',
    sourceBook: '《六壬神课金口诀》卷之上',
    verse: '干方同为兄弟动：凡占，事在比肩朋友，小凶。',
    modernAdvice: '原文主比肩朋友之事，断小凶。',
  },
};

export function getJinkoujueMovementClassic(key: string): JinkoujueMovementClassic | undefined {
  if (!Object.prototype.hasOwnProperty.call(JINKOUJUE_MOVEMENT_CLASSICS, key)) return undefined;
  return JINKOUJUE_MOVEMENT_CLASSICS[key as JinkoujueMovement['name']];
}
