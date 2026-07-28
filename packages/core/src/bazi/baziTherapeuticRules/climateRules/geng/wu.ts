import type { ClimateRule } from '../../types';

export const GENG_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-geng-bing-ren-jia-all',
    label: '庚日午月丙壬甲全透富贵规则',
    description: '庚金生午月，丙火当令，壬水为佐，甲木为使；若三者全透，多主富贵双全。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丙', '壬', '甲'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '木'],
    traceHints: ['取用层次:丙壬甲三者全透', '成格层次:富贵双全'],
    hint: '庚金午月丙壬甲三者全透，富贵双全',
  },
  {
    id: 'wu-month-geng-bing-jia-first',
    label: '庚日午月先丙后甲壬规则',
    description: '庚金生午月，火烈金熔，传统多先取丙火制刃，次甲木裁抑，壬水洗涤，方可成器。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '水'],
    hint: '庚金午月，先丙后甲壬',
  },
  {
    id: 'wu-month-geng-ren-ding',
    label: '庚日午月壬透丁佐规则',
    description:
      '庚金生午月，火烈金熔，壬水为救，丁火炼金为佐。壬透丁佐，科甲可期，不宜仍按夏金泛化扶抑。',
    months: ['午'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '庚金午月，壬水为救，丁火佐之，壬透丁佐科甲',
  },
];
