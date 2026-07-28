import type { ClimateRule } from '../../types';

export const REN_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-ren-gui-geng',
    label: '壬日午月癸庚并用规则',
    description: '壬水生午月，丁火当令，传统以癸水为用、庚金为佐，不宜仅按夏水泛化为比劫或印星。',
    months: ['午'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    hint: '壬水午月，取癸为用，庚金为佐',
  },
  {
    id: 'wu-month-ren-bing-first',
    label: '壬日午月先丙后辛规则',
    description: '壬水生午月，丁火司权，传统多以丙火制刃为先、辛金发源为佐，较夏水泛化更细。',
    months: ['午'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    hint: '壬水午月，先丙后辛',
  },
  {
    id: 'wu-month-ren-bing-xin-all',
    label: '壬日午月丙辛两透富贵规则',
    description:
      '壬水生午月，若丙辛两透，较合原文"壬水生午月，身强才旺有根，丙辛两透，定主雁塔有名"。',
    months: ['午'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['丙', '辛'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    traceHints: ['取用层次:丙辛两透', '成格层次:雁塔有名'],
    hint: '壬水午月丙辛两透，多主雁塔有名',
  },
];
