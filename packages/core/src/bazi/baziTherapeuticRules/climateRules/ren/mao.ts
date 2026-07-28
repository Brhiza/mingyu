import type { ClimateRule } from '../../types';

export const REN_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-ren-bing-jia-all',
    label: '壬日卯月丙甲两透科甲规则',
    description:
      '壬水生卯月，若丙甲两透，较合原文"壬水生卯月，身强才旺有根，丙甲两透，定主雁塔有名"。',
    months: ['卯'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['丙', '甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    traceHints: ['取用层次:丙甲两透', '成格层次:雁塔有名'],
    hint: '壬水卯月丙甲两透，多主雁塔有名',
  },
  {
    id: 'mao-month-ren-bing-first',
    label: '壬日卯月先丙后甲规则',
    description: '壬水生卯月，卯木泄水生火，传统多以丙火为君、甲木为臣，先暖后发。',
    months: ['卯'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '壬水卯月，先丙后甲',
  },
  {
    id: 'mao-month-ren-wu-xin',
    label: '壬日卯月戊辛并用规则',
    description:
      '壬水生卯月，木旺泄水，戊土止流为君，辛金发源为佐。戊辛两透，富贵可期，不宜只按春水泛化扶抑。',
    months: ['卯'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '土',
    favorableOrder: ['土', '金'],
    hint: '壬水卯月，戊土止流，辛金发源，戊辛两透富贵',
  },
];
