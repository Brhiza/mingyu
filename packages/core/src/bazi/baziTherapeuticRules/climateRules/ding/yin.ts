import type { ClimateRule } from '../../types';

export const DING_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-ding-bing-jia-first',
    label: '丁日寅月先丙后甲规则',
    description: '丁火生寅月，木火相生，传统多以甲木为君、丙火为臣，先发后暖。',
    months: ['寅'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    hint: '丁火寅月，先丙后甲',
  },
  {
    id: 'yin-month-ding-jia-geng-all',
    label: '丁日寅月甲庚两透显达规则',
    description: '丁火生寅月，若甲庚两透，较合原文"身强才旺有根，甲庚两透，定主雁塔有名"。',
    months: ['寅'],
    dayMasters: ['火'],
    dayStems: ['丁'],
    requiredVisibleStems: ['甲', '庚'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    traceHints: ['取用层次:甲庚两透', '成格层次:雁塔有名'],
    hint: '丁火寅月甲庚两透，多主雁塔有名',
  },
];
