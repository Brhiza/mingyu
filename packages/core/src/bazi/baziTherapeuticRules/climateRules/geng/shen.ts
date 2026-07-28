import type { ClimateRule } from '../../types';

export const GENG_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-geng-jia-bing-first',
    label: '庚日申月丁甲丙先庚规则',
    description:
      '庚金生申月，秋金得令，传统多先丁火锻炼，次甲木裁抑，丙火为佐，较一般秋金喜水更合原法。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金申月，先丁次甲，丙火为佐',
  },
  {
    id: 'shen-month-geng-jia-ding-all',
    label: '庚日申月甲丁两透富贵规则',
    description: '庚金生申月，若甲丁两透而身强，较合原文"身强才旺有根，甲丁两透，定主雁塔有名"。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['甲', '丁'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    traceHints: ['取用层次:甲丁两透', '成格层次:雁塔有名'],
    hint: '庚金申月甲丁两透，多主雁塔有名',
  },
  {
    id: 'shen-month-geng-ding-jia',
    label: '庚日申月丁甲并用规则',
    description:
      '庚金生申月，金旺得令，丁火炼金为用，甲木引丁为佐。丁甲两透，科甲定然，不宜仍按秋金清润一概论之。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金申月，丁火炼金，甲木引丁，丁甲两透科甲',
  },
];
