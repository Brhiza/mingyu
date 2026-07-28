import type { ClimateRule } from '../../types';

export const GENG_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-geng-jia-bing-first',
    label: '庚日巳月先丙后甲规则',
    description:
      '庚金生巳月，火旺金熔，传统多以丙火为君、甲木为佐，壬水为使，较一般夏金扶抑更合原法。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '水'],
    hint: '庚金巳月，先丙后甲',
  },
  {
    id: 'si-month-geng-bing-ren-jia-all',
    label: '庚日巳月丙壬甲全透极品规则',
    description: '庚金生巳月，丙壬甲三者全透，较合原文"庚金生巳月，丙壬甲三者全透，鼎甲可期"。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丙', '壬', '甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '木'],
    traceHints: ['取用层次:丙壬甲三者全透', '成格层次:鼎甲可期'],
    hint: '庚金巳月丙壬甲三者全透，鼎甲可期',
  },
  {
    id: 'si-month-geng-bing-first-jia-assist',
    label: '庚日巳月丙火为先甲木佐之规则',
    description: '庚金生巳月，丙火当权司令，传统以丙火为先、甲木为佐，方能锻链成器。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金巳月，丙火为先，甲木佐之',
  },
  {
    id: 'si-month-geng-ren-bing',
    label: '庚日巳月壬丙并用规则',
    description:
      '庚金生巳月，火旺金熔，壬水制火为要，丙火又不可缺。壬丙两透，富贵双全，不宜直接泛化为金印为先。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '庚金巳月，壬制火为要，丙不可缺，壬丙两透富贵',
  },
];
